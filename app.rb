# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'pry'
require 'securerandom'
require 'openai'
require 'dotenv/load'

# Thin client for the ABAIR v4 API (https://api.abair.ie/v4/docs).
# The API key stays on the server; the mobile app only talks to this backend.
class AbairClient
  class Error < StandardError
    attr_reader :status

    def initialize(message, status = nil)
      super(message)
      @status = status
    end
  end

  class Unauthorized < Error; end
  class QuotaExceeded < Error; end

  DEFAULT_URL = 'https://api.abair.ie/v4'.freeze

  # The old v3 voice names look like "ga_UL_anb_piper"; v4 ids look like "anb.piper".
  # This mapping is inferred from the naming pattern, so check it against #voices.
  LEGACY_VOICE = /\Aga_[A-Z]{2}_(?<name>[a-z0-9]+)_(?<engine>[a-z0-9]+)\z/

  def self.voice_id(voice)
    match = LEGACY_VOICE.match(voice.to_s)
    match ? "#{match[:name]}.#{match[:engine]}" : voice.to_s
  end

  def initialize(api_key: ENV['ABAIR_API_KEY'], base_url: ENV.fetch('ABAIR_API_URL', DEFAULT_URL))
    raise Error, 'ABAIR_API_KEY is not set' if api_key.nil? || api_key.empty?

    @api_key = api_key
    @base_url = base_url.chomp('/')
  end

  # Batch speech recognition. Accepts any audio format ffmpeg can decode,
  # up to 30 seconds and 5 MB. Returns the transcript text.
  def recognise(audio_bytes, filename: 'audio.m4a', punctuate: false)
    request = Net::HTTP::Post.new(uri('/recognition/batch', captpunct: punctuate))
    request.set_form(
      [['file', audio_bytes, { filename: filename, content_type: 'application/octet-stream' }]],
      'multipart/form-data'
    )
    perform(request).fetch('text', '')
  end

  # Text to speech. Returns the parsed response, which includes a base64 WAV in "audioContent".
  def synthesise(text, voice:, speed: 1.0)
    request = Net::HTTP::Post.new(uri('/synthesis', outputType: 'JSON', audioEncoding: 'WAV'))
    request['Content-Type'] = 'application/json'
    request.body = { input: text, voice: self.class.voice_id(voice), speed: speed }.to_json
    perform(request)
  end

  def voices
    perform(Net::HTTP::Get.new(uri('/synthesis/voices')))
  end

  private

  def uri(path, params = {})
    URI("#{@base_url}#{path}").tap { |u| u.query = URI.encode_www_form(params) unless params.empty? }
  end

  def perform(request)
    request['abair-api-key'] = @api_key
    response = Net::HTTP.start(request.uri.host, request.uri.port, use_ssl: request.uri.scheme == 'https') do |http|
      http.request(request)
    end
    parse(response)
  end

  def parse(response)
    status = response.code.to_i
    return JSON.parse(response.body) if status.between?(200, 299)

    message = error_message(response)
    case status
    when 401, 403 then raise Unauthorized.new(message, status)
    when 429 then raise QuotaExceeded.new(message, status)
    else raise Error.new(message, status)
    end
  end

  def error_message(response)
    body = JSON.parse(response.body)
    body['message'] || body['error'] || response.body
  rescue JSON::ParserError
    "ABAIR API returned #{response.code}"
  end
end

DEFAULT_VOICE = ENV.fetch('ABAIR_DEFAULT_VOICE', 'ga_UL_anb_piper')

# Session configuration
enable :sessions
set :session_secret, ENV['SESSION_SECRET'] || SecureRandom.hex(64)

set :public_folder, File.dirname(__FILE__)
set :port, ENV['PORT'] || 8080

# CORS for mobile app
before do
  headers['Access-Control-Allow-Origin'] = '*'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key'
end

options '*' do
  200
end

# API key authentication for mobile endpoints
before do
  # Skip authentication for OPTIONS requests (CORS preflight)
  next if request.request_method == 'OPTIONS'

  # Check API key for all API endpoints
  if request.path.start_with?('/api/') || request.path == '/forward_audio' || request.path == '/reset'
    api_key = request.env['HTTP_X_API_KEY']
    expected_key = ENV['APP_API_KEY']

    if expected_key && api_key != expected_key
      halt 401, {'Content-Type' => 'application/json'}, {error: 'Invalid API key'}.to_json
    end
  end
end

# Global error handler for API endpoints - return JSON instead of HTML
error do
  err = env['sinatra.error']

  if request.path.start_with?('/api/') || request.path == '/forward_audio' || request.path == '/reset'
    content_type :json
    status 500

    puts "[global_error] #{err.class}: #{err.message}"
    puts err.backtrace.first(10)

    {
      error: err.message,
      error_class: err.class.to_s
    }.to_json
  else
    # For non-API routes, use default HTML error handling
    status 500
    "Internal Server Error"
  end
end

# Landing page
get '/' do
  erb :index
end

# Reset conversation session (used by mobile app)
get '/reset' do
  session.clear
  puts "clearing session"
  content_type :json
  { success: true }.to_json
end

# Conversation mode: Irish ASR → GPT chat → Irish TTS (used by mobile app)
post '/forward_audio' do
  content_type :json

  begin
    puts "[forward_audio] Starting audio processing..."
    request_payload = JSON.parse(request.body.read)
    audio_blob = request_payload['audio_blob']

    if audio_blob.nil? || audio_blob.empty?
      puts "[forward_audio] ERROR: No audio blob provided"
      status 400
      return { error: 'No audio data provided' }.to_json
    end

    # Initialize session if not set
    session[:context] ||= [
      { role: 'system', content: "You are an Irish speaker called 'An Chaothernach'. You are chatting with another Irish speaker about everyday things, e.g. your job, your family, holidays, the news, the weather, hobbies, etc. Try not to give long answers. If you don't understand, say it." }
    ]
    session[:guth] ||= DEFAULT_VOICE

    # Transcribe Irish audio
    puts "[forward_audio] Transcribing Irish audio..."
    prompt = transcribe_irish(audio_blob)

    if prompt.empty?
      puts "[forward_audio] ERROR: No transcription received"
      status 500
      return { error: 'Failed to transcribe audio' }.to_json
    end

    puts "[forward_audio] User said: #{prompt}"

    # Add to context and get GPT response
    session[:context] << { role: "user", content: prompt }
    puts "[forward_audio] Getting GPT response..."
    reply = chat_with_gpt
    session[:context] << { role: "assistant", content: reply }
    puts "[forward_audio] Assistant replied: #{reply}"

    # Synthesize speech and return
    puts "[forward_audio] Synthesizing speech..."
    payload = synthesize_speech(reply, session[:guth])
    payload["tusa"] = prompt
    payload["sise"] = reply
    puts "[forward_audio] Success! Returning response"
    payload.to_json
  rescue JSON::ParserError => e
    puts "[forward_audio] JSON Parse Error: #{e.message}"
    puts e.backtrace.first(5)
    status 400
    { error: "Invalid JSON: #{e.message}" }.to_json
  rescue AbairClient::Error => e
    abair_error_response(e)
  rescue => e
    puts "[forward_audio] Error in conversation: #{e.message}"
    puts e.backtrace.first(5)
    status 500
    { error: e.message }.to_json
  end
end

def abair
  @abair ||= AbairClient.new
end

# Irish speech to text via the ABAIR API. Takes the base64 audio the mobile app sends.
def transcribe_irish(audio_base64)
  abair.recognise(Base64.decode64(audio_base64)).strip
end

# Status codes for ABAIR failures: 429 when the daily quota is spent, 502 for anything else upstream.
def abair_error_response(error)
  puts "[abair] #{error.class}: #{error.message}"
  status(error.is_a?(AbairClient::QuotaExceeded) ? 429 : 502)
  { error: error.message, error_class: error.class.to_s }.to_json
end

def chat_with_gpt
  response = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG']).chat(parameters: {
    model: 'gpt-4o',
    messages: session[:context],
    temperature: 0.5
  })
  # puts response
  response.dig('choices', 0, 'message', 'content')
rescue => e
  puts "[chat_with_gpt] Error: #{e.message}"
  "Tá aiféala orm ach tá ganntanas airgid ag cur isteach orm. Tá mo OpenAI cúntas folamh, is dóigh liom."
end

# Irish text to speech via the ABAIR API. The response includes base64 WAV in "audioContent".
def synthesize_speech(text, voice)
  abair.synthesise(text, voice: voice)
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
  voice = request_payload['voice'] || session[:guth] || DEFAULT_VOICE

  synthesize_speech(text, voice).to_json
rescue AbairClient::Error => e
  abair_error_response(e)
rescue => e
  puts "Error in TTS: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# English ASR endpoint (for expansion refinements)
post '/api/asr/english' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']

  transcription = transcribe_english(audio_blob)
  { transcription: transcription }.to_json
rescue => e
  puts "Error in English ASR: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# Irish ASR endpoint (for future practice mode)
post '/api/asr/irish' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']

  { transcription: transcribe_irish(audio_blob) }.to_json
rescue AbairClient::Error => e
  abair_error_response(e)
rescue => e
  puts "Error in Irish ASR: #{e.message}"
  status 500
  { error: e.message }.to_json
end

# Voices available to this ABAIR API key (ids to use as "voice" or ABAIR_DEFAULT_VOICE)
get '/api/voices' do
  content_type :json
  abair.voices.to_json
rescue AbairClient::Error => e
  abair_error_response(e)
end

# Expand an existing island with more sentences
post '/api/islands/:id/expand' do
  content_type :json
  request_payload = JSON.parse(request.body.read)
  island_data = request_payload['island']
  refinement = request_payload['refinement']

  new_sentences = expand_island(island_data, refinement)
  new_sentences.to_json
rescue => e
  puts "Error expanding island: #{e.message}"
  puts e.backtrace.first(5)
  status 500
  { error: e.message }.to_json
end

# Generate vocabulary for an island
post '/api/islands/:id/vocabulary' do
  content_type :json

  begin
    request_payload = JSON.parse(request.body.read)
    island_data = request_payload['island']

    puts "[vocabulary] Received request for island: #{island_data['id']}"
    puts "[vocabulary] Island has #{island_data['sentences']&.length || 0} sentences"

    vocabulary = generate_vocabulary(island_data)
    puts "[vocabulary] Generated #{vocabulary['vocabulary']&.length || 0} vocab words"
    vocabulary.to_json
  rescue JSON::ParserError => e
    puts "[vocabulary] JSON Parse Error: #{e.message}"
    puts e.backtrace.first(10)
    status 400
    { error: "Invalid JSON: #{e.message}" }.to_json
  rescue => e
    puts "[vocabulary] Error: #{e.message}"
    puts "[vocabulary] Error class: #{e.class}"
    puts e.backtrace.first(10)
    status 500
    { error: e.message, error_class: e.class.to_s }.to_json
  end
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
    - Use natural, conversational Irish from Connacht/Ulster dialects (Galway, Mayo, Donegal)
    - Avoid Munster/Standard Irish forms where Connacht/Ulster alternatives exist
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
    model: 'gpt-4o',
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

def expand_island(island_data, refinement)
  client = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG'])

  # Build context of existing sentences
  existing_sentences_text = island_data['sentences'].map do |s|
    "- #{s['irish']} (#{s['english']})"
  end.join("\n")

  system_prompt = <<~PROMPT
    You are an expert Irish language teacher helping expand an existing "island of fluency" (oileán líofachta).
    The learner already has these sentences:

    #{existing_sentences_text}

    Based on their refinement request, add 3-5 new sentences that complement what they already have.

    Guidelines:
    - Use natural, conversational Irish from Connacht/Ulster dialects (Galway, Mayo, Donegal)
    - Avoid Munster/Standard Irish forms where Connacht/Ulster alternatives exist
    - Build on the existing sentences where appropriate
    - Keep sentences relatively short and memorable
    - Include phrases that naturally extend the topic
    - Provide accurate English translations

    IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
    {
      "sentences": [
        {"irish": "Irish sentence 1", "english": "English translation 1"},
        {"irish": "Irish sentence 2", "english": "English translation 2"}
      ]
    }
  PROMPT

  response = client.chat(parameters: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system_prompt },
      { role: 'user', content: "Add more sentences for: #{refinement}" }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  })

  result = JSON.parse(response.dig('choices', 0, 'message', 'content'))

  # Build sentence objects with new IDs
  island_id = island_data['id']
  current_count = island_data['sentences'].length

  sentences = result['sentences'].map.with_index do |s, i|
    {
      id: "#{island_id}-#{current_count + i}",
      irish: s['irish'],
      english: s['english']
    }
  end

  { sentences: sentences }
end

def generate_vocabulary(island_data)
  raise "Island data is nil" if island_data.nil?
  raise "Island has no sentences" if island_data['sentences'].nil? || island_data['sentences'].empty?

  client = OpenAI::Client.new(access_token: ENV['OPENAI_KEY'], organization_id: ENV['OPENAI_ORG'])

  # Build sentences text
  sentences_text = island_data['sentences'].map do |s|
    "- #{s['irish']} (#{s['english']})"
  end.join("\n")

  puts "[generate_vocabulary] Sentences text length: #{sentences_text.length} chars"

  system_prompt = <<~PROMPT
    You are an expert Irish language teacher creating a vocabulary list from an "island of fluency" (oileán líofachta).

    From these Irish sentences, extract 8-10 TOPIC-SPECIFIC vocabulary words:

    #{sentences_text}

    CRITICAL: This vocabulary list is for learners who already know basic Irish. They need topic-specific vocabulary, NOT common everyday words.

    EXCLUDE these types of common words:
    - Basic verbs: bí, déan, abair, rá, téigh, tar, faigh, tabhair, feic, clois
    - Basic adjectives: maith, dona, mór, beag, fada, gearr
    - Common prepositions/particles: ag, le, ar, do, de, i, ó, as, faoi, etc.
    - Basic pronouns: mé, tú, sé, sí, etc.

    INCLUDE only:
    - Topic-specific nouns (e.g., toghchán=election, peileadóir=footballer, aimsir=weather)
    - Topic-specific verbs (e.g., vótáil=vote, scóráil=score, báisteach=rain)
    - Specialized adjectives/descriptors related to the topic
    - Technical or domain-specific terms

    Guidelines:
    - Include the word in its base/dictionary form
    - If the word appears in a mutated or inflected form, note the base form
    - Provide a concise English definition (1-3 words)
    - Include an example showing how it's used in the sentences above
    - Focus on words that are unique to this topic/domain

    IMPORTANT: Respond ONLY with valid JSON in this exact format, no other text:
    {
      "vocabulary": [
        {
          "irish": "focal",
          "english": "word",
          "example": "Tá focal agam duit"
        }
      ]
    }
  PROMPT

  puts "[generate_vocabulary] Calling OpenAI..."
  response = client.chat(parameters: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system_prompt },
      { role: 'user', content: "Extract the key vocabulary from these sentences." }
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' }
  })

  content = response.dig('choices', 0, 'message', 'content')
  puts "[generate_vocabulary] OpenAI response length: #{content&.length || 0} chars"

  result = JSON.parse(content)
  puts "[generate_vocabulary] Parsed vocabulary with #{result['vocabulary']&.length || 0} words"
  result
rescue StandardError => e
  puts "[generate_vocabulary] Exception: #{e.message}"
  puts "[generate_vocabulary] Exception class: #{e.class}"
  raise e
end
