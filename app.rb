# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'pry'

enable :sessions

set :public_folder, File.dirname(__FILE__)

get '/' do
  session[:context] ||= [
    { role: 'system', content: "You are an Irish speaker called 'An Chaothernach'. You are chatting with another Irish speaker about everyday things, e.g. your job, your family, holidays, the news, the weather, hobbies, etc. Try not to give long answers. If you don't understand, say it." }
  ]
  session[:guth] ||= 'ga_UL_anb_nemo'
  @context = session[:context].detect { |line| line[:role] == 'system' }.dig(:content)
  @guth = session[:guth]
  puts @context, @guth
  erb :index
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
  # puts response
  prompt = JSON.parse(response.to_json).dig("transcriptions", 0, "utterance")
  # puts prompt
  session[:context] << { role: "user", content: prompt }
  # puts prompt
  reply = chat_with_gpt
  session[:context] << { role: "assistant", content: reply }
  # puts reply
  content_type :json
  synthesize_speech(reply)
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
  uri = URI.parse('https://abair.ie/api2/synthesise')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)
  request.body = {
    synthinput: { text: text, ssml: 'string' },
    voiceparams: { languageCode: 'ga-IE', name: session[:guth], ssmlGender: 'UNSPECIFIED' },
    audioconfig: { audioEncoding: 'LINEAR16', speakingRate: 1, pitch: 1, volumeGainDb: 1 },
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
