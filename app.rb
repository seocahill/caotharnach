# app.rb
require 'sinatra'
require 'json'
require 'net/http'
require 'uri'

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

def process_audio(audio_blob)
  # Replace with your actual API endpoint and logic for audio processing
  uri = URI.parse('https://phoneticsrv3.lcs.tcd.ie/asr_api/recognise')
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.path)
  form_data = {
    'recogniseBlob' => UploadIO.new(StringIO.new(audio_blob), 'audio/wav', 'audio.wav'),
    'developer' => 'true',
    'method' => 'online2bin'
  }
  request.set_form(form_data)
  response = http.request(request)
  JSON.parse(response.body)
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
