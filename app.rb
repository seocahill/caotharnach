# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'pry'

OpenAI.configure do |config|
  config.access_token = ENV['OPENAI_KEY']
  config.organization_id = ENV['OPENAI_ORG']
end

$context = [
  { role: 'system', content: "You are an Irish speaker called 'An Chaothernach'. You are chatting with another Irish speaker about everyday things, e.g. your job, your family, holidays, the news, the weather, etc." }
]

set :public_folder, File.dirname(__FILE__)

get '/' do
  erb :index
end

post '/forward_audio' do
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']
  response = forward_audio(audio_blob)
  prompt = JSON.parse(response.to_json).dig("transcriptions", 0, "utterance")
  $context << { role: "user", content: prompt }
  puts prompt
  reply = chat_with_gpt
  $context << { role: "assistant", content: reply }
  puts reply
  content_type :json
  synthesize_speech(reply)
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
  $context.last(10).join('\n')
end

def chat_with_gpt
  response = OpenAI::Client.new.chat(parameters: {
    model: 'gpt-3.5-turbo',
    messages: $context,
    temperature: 0.5
  })
  puts response
  response.dig('choices', 0, 'message', 'content')
end

def synthesize_speech(text)
  # Replace with your actual API endpoint and logic for speech synthesis
  uri = URI.parse('https://abair.ie/api2/synthesise')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)
  request.body = {
    synthinput: { text: text, ssml: 'string' },
    voiceparams: { languageCode: 'ga-IE', name: 'ga_UL_anb_nemo', ssmlGender: 'UNSPECIFIED' },
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
  $context.last(2).to_json
end

