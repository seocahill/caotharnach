# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'pry'
require 'securerandom'
require 'openai'

enable :sessions

set :public_folder, File.dirname(__FILE__)
set :port, ENV['PORT'] || 8080

# CORS for mobile app
before do
  headers['Access-Control-Allow-Origin'] = '*'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  headers['Access-Control-Allow-Headers'] = 'Content-Type'
end

options '*' do
  200
end

get '/' do
  session[:context] ||= [
    { role: 'system', content: "You are an Irish speaker called 'An Chaothernach'. You are chatting with another Irish speaker about everyday things, e.g. your job, your family, holidays, the news, the weather, hobbies, etc. Try not to give long answers. If you don't understand, say it." }
  ]
  session[:guth] ||= 'ga_UL_anb_piper'
  @context = session[:context].detect { |line| line[:role] == 'system' }.dig(:content)
  @guth = session[:guth]
  puts @context, @guth
  erb :index
end

get '/reset' do
  session.clear
  puts "clearning session"
  redirect '/'
end

post '/set_context' do
  session[:context] = [
    { role: 'system', content: params["context"] }
  ]
  session[:guth] = params["guth"]
  puts params
  redirect '/'
end

post '/forward_audio' do
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']
  response = forward_audio(audio_blob)
  puts response
  prompt = JSON.parse(response.to_json).dig("transcriptions", 0, "utterance")
  puts prompt
  session[:context] << { role: "user", content: prompt }
  # puts prompt
  reply = chat_with_gpt
  session[:context] << { role: "assistant", content: reply }
  # puts reply
  content_type :json
  payload = JSON.parse(synthesize_speech(reply))
  payload["tusa"] = prompt
  payload["sise"] = reply
  payload.to_json
rescue => e
  puts e
end

def forward_audio(audio_blob)
  uri = URI.parse('https://phoneticsrv3.lcs.tcd.ie/asr_api/recognise')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)

  payload = {
    recogniseBlob: audio_blob,
    developer: true,
    method: 'online2bin'
  }

  request.body = payload.to_json
  request['Content-Type'] = 'application/json'

  response = http.request(request)
  JSON.parse(response.body)
end

def truncated_context
  session[:context].last(10).join('\n')
end

def chat_with_gpt
  response = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG']).chat(parameters: {
    model: 'gpt-4-1106-preview',
    messages: session[:context],
    temperature: 0.5
  })
  # puts response
  response.dig('choices', 0, 'message', 'content')
rescue => e
  "Tá aiféala orm ach tá ganntanas airgid ag cur isteach orm. Tá mo OpenAI cúntas folamh, is dóigh liom."
end

def synthesize_speech(text)
  uri = URI.parse('https://api.abair.ie/v3/synthesis')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  # Disable SSL verification for this specific request
  http.verify_mode = OpenSSL::SSL::VERIFY_NONE
  request = Net::HTTP::Post.new(uri.path)
  request.body = {
    synthinput: { text: text, ssml: 'string' },
    voiceparams: { languageCode: 'ga-IE', name: session[:guth], ssmlGender: 'UNSPECIFIED' },
    audioconfig: {
      audioEncoding: 'LINEAR16',
      speakingRate: 1,
      pitch: 1,
      volumeGainDb: 1,
      htsParams: 'string',
      sampleRateHertz: 0,
      effectsProfileId: []
    },
    outputType: 'JSON'
  }.to_json
  request['Content-Type'] = 'application/json'
  response = http.request(request)
  response.body
end

get '/get_context' do
  content_type :json
  # Assuming contextArray is an array containing conversation history
  puts "===================="
  puts session[:context].last(2)
    puts "===================="

  session[:context].last(2).to_json
end

# ============================================
# ISLAND API ENDPOINTS (for mobile app)
# ============================================

# Create island from audio (English description)
post '/api/islands' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']
  voice = request_payload['voice'] || 'ga_UL_anb_piper'

  # Transcribe English audio using OpenAI Whisper
  description = transcribe_english(audio_blob)
  puts "Transcribed description: #{description}"

  # Generate island using GPT-4
  island = generate_island(description, voice)
  island.to_json
rescue => e
  puts "Error creating island: #{e.message}"
  puts e.backtrace.first(5)
  status 500
  { error: e.message }.to_json
end

# Create island from text (manual input)
post '/api/islands/text' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  description = request_payload['description']
  voice = request_payload['voice'] || 'ga_UL_anb_piper'

  island = generate_island(description, voice)
  island.to_json
rescue => e
  puts "Error creating island from text: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# TTS endpoint for individual sentences
post '/api/tts' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  text = request_payload['text']
  voice = request_payload['voice'] || session[:guth] || 'ga_UL_anb_piper'

  result = synthesize_speech_for_api(text, voice)
  result.to_json
rescue => e
  puts "Error in TTS: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# Irish ASR endpoint (for future practice mode)
post '/api/asr/irish' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']

  response = forward_audio(audio_blob)
  transcription = response.dig("transcriptions", 0, "utterance")

  { transcription: transcription }.to_json
rescue => e
  puts "Error in Irish ASR: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# ============================================
# HELPER FUNCTIONS FOR ISLANDS
# ============================================

def transcribe_english(audio_base64)
  # Decode base64 and save to temp file
  require 'tempfile'
  audio_data = Base64.decode64(audio_base64)

  temp_file = Tempfile.new(['audio', '.m4a'])
  temp_file.binmode
  temp_file.write(audio_data)
  temp_file.rewind

  begin
    client = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG'])
    response = client.audio.transcribe(
      parameters: {
        model: 'whisper-1',
        file: File.open(temp_file.path, 'rb'),
        language: 'en'
      }
    )
    response['text']
  ensure
    temp_file.close
    temp_file.unlink
  end
end

def generate_island(description, voice)
  client = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG'])

  system_prompt = <<~PROMPT
    You are an expert Irish language teacher creating "islands of fluency" (oileáin líofachta) for learners.
    Based on the user's description, create a short set of 5-8 useful Irish sentences they can memorize and use in conversation.

    Guidelines:
    - Use natural, conversational Irish
    - Include a mix of statements, questions, and responses
    - Keep sentences relatively short and memorable
    - Include common phrases that would naturally come up in this topic
    - Provide accurate English translations

    IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
    {
      "title": "Short English title for this island",
      "titleIrish": "Irish translation of title",
      "sentences": [
        {"irish": "Irish sentence 1", "english": "English translation 1"},
        {"irish": "Irish sentence 2", "english": "English translation 2"}
      ]
    }
  PROMPT

  response = client.chat(parameters: {
    model: 'gpt-4-1106-preview',
    messages: [
      { role: 'system', content: system_prompt },
      { role: 'user', content: "Create an island for: #{description}" }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  })

  result = JSON.parse(response.dig('choices', 0, 'message', 'content'))

  # Build the island object
  island_id = SecureRandom.hex(6)
  now = Time.now.iso8601

  sentences = result['sentences'].map.with_index do |s, i|
    {
      id: "#{island_id}-#{i}",
      irish: s['irish'],
      english: s['english']
    }
  end

  {
    id: island_id,
    title: result['title'],
    titleIrish: result['titleIrish'],
    description: description,
    sentences: sentences,
    createdAt: now,
    updatedAt: now,
    voice: voice
  }
end

def synthesize_speech_for_api(text, voice)
  uri = URI.parse('https://api.abair.ie/v3/synthesis')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  http.verify_mode = OpenSSL::SSL::VERIFY_NONE
  request = Net::HTTP::Post.new(uri.path)
  request.body = {
    synthinput: { text: text, ssml: 'string' },
    voiceparams: { languageCode: 'ga-IE', name: voice, ssmlGender: 'UNSPECIFIED' },
    audioconfig: {
      audioEncoding: 'LINEAR16',
      speakingRate: 1,
      pitch: 1,
      volumeGainDb: 1,
      htsParams: 'string',
      sampleRateHertz: 0,
      effectsProfileId: []
    },
    outputType: 'JSON'
  }.to_json
  request['Content-Type'] = 'application/json'
  response = http.request(request)
  JSON.parse(response.body)
end
