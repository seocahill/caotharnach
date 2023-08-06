# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'
require 'pry'

set :public_folder, File.dirname(__FILE__)

get '/' do
  erb :index
end

post '/process_audio' do
  audio_blob = params[:audio][:tempfile].read
  response = process_audio(audio_blob)
  content_type :json
  response.to_json
end

post '/synthesize_speech' do
  text = params[:text]
  audio_content = synthesize_speech(text)
  content_type :json
  { audioContent: audio_content }.to_json
end

post '/chat_with_gpt' do
  user_input = params[:user_input]
  gpt_response = chat_with_gpt(user_input)
  content_type :json
  { response: gpt_response.choices[0].text.strip }.to_json
end

post '/forward_audio' do
  request_payload = JSON.parse(request.body.read)
  audio_blob = request_payload['audio_blob']
  response = forward_audio(audio_blob)
  content_type :json
  response.to_json
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



def chat_with_gpt(user_input)
  # Replace with your actual OpenAI GPT-3 API endpoint and authorization
  api_key = 'YOUR_OPENAI_API_KEY'
  gpt_endpoint = 'https://api.openai.com/v1/engines/gpt-3.5-turbo/completions'

  uri = URI.parse(gpt_endpoint)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)
  request['Authorization'] = "Bearer #{api_key}"
  request['Content-Type'] = 'application/json'
  request.body = {
    prompt: user_input,
    max_tokens: 50  # Adjust as needed
  }.to_json

  response = http.request(request)
  JSON.parse(response.body)
end

def process_audio(audio_blob)
  uri = URI.parse('https://phoneticsrv3.lcs.tcd.ie/asr_api/recognise')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)

  # Construct JSON payload
  payload = {
    recogniseBlob: Base64.strict_encode64(audio_blob),  # Encode audio as base64
    developer: true,
    method: 'online2bin'
  }

  request.body = payload.to_json
  request['Content-Type'] = 'application/json'
  debugger
  # response = http.request(request)
  # JSON.parse(response.body)
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
  data = JSON.parse(response.body)
  data['audioContent']
end
