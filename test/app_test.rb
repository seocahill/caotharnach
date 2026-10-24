require_relative 'test_helper'
require_relative '../app'

class AppTest < Minitest::Test
  include Rack::Test::Methods

  def app
    Sinatra::Application
  end

  def stub_chat(reply)
    stub_request(:post, 'https://api.openai.com/v1/chat/completions')
      .to_return(status: 200, headers: { 'Content-Type' => 'application/json' },
                 body: { choices: [{ message: { role: 'assistant', content: reply } }] }.to_json)
  end

  def stub_asr(text)
    stub_request(:post, %r{https://api\.abair\.ie/v4/recognition/batch})
      .to_return(status: 200, body: { text: text }.to_json)
  end

  def stub_tts
    stub_request(:post, %r{https://api\.abair\.ie/v4/synthesis})
      .to_return(status: 200, body: { audioContent: 'QUJD' }.to_json)
  end

  def post_json(path, body)
    post path, body.to_json, 'CONTENT_TYPE' => 'application/json'
  end

  def test_forward_audio_runs_asr_then_chat_then_tts
    stub_asr('dia dhuit')
    stub_chat('Dia is Muire dhuit!')
    stub_tts

    post_json '/forward_audio', audio_blob: Base64.strict_encode64('audio')

    assert_equal 200, last_response.status
    body = JSON.parse(last_response.body)
    assert_equal 'QUJD', body['audioContent']
    assert_equal 'dia dhuit', body['tusa']
    assert_equal 'Dia is Muire dhuit!', body['sise']
    assert_requested(:post, %r{api\.abair\.ie/v4/synthesis}) { |req| JSON.parse(req.body)['voice'] == 'anb.piper' }
  end

  def test_forward_audio_reports_empty_transcription
    stub_asr('')

    post_json '/forward_audio', audio_blob: Base64.strict_encode64('audio')

    assert_equal 500, last_response.status
    assert_equal 'Failed to transcribe audio', JSON.parse(last_response.body)['error']
  end

  def test_forward_audio_returns_429_when_abair_quota_is_spent
    stub_request(:post, %r{https://api\.abair\.ie/v4/recognition/batch})
      .to_return(status: 429, body: { message: 'Daily balance exhausted' }.to_json)

    post_json '/forward_audio', audio_blob: Base64.strict_encode64('audio')

    assert_equal 429, last_response.status
    assert_equal 'AbairClient::QuotaExceeded', JSON.parse(last_response.body)['error_class']
  end

  def test_tts_endpoint_uses_requested_voice
    stub_tts

    post_json '/api/tts', text: 'Dia dhuit', voice: 'ga_MU_nnc_piper'

    assert_equal 200, last_response.status
    assert_equal 'QUJD', JSON.parse(last_response.body)['audioContent']
    assert_requested(:post, %r{api\.abair\.ie/v4/synthesis}) { |req| JSON.parse(req.body)['voice'] == 'nnc.piper' }
  end

  def test_irish_asr_endpoint
    stub_asr('tá mé go maith')

    post_json '/api/asr/irish', audio_blob: Base64.strict_encode64('audio')

    assert_equal 'tá mé go maith', JSON.parse(last_response.body)['transcription']
  end

  def test_voices_endpoint
    stub_request(:get, 'https://api.abair.ie/v4/synthesis/voices').to_return(status: 200, body: [{ id: 'anb.piper' }].to_json)

    get '/api/voices'

    assert_equal [{ 'id' => 'anb.piper' }], JSON.parse(last_response.body)
  end
end
