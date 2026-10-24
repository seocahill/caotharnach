require_relative 'test_helper'
require_relative '../app'

class AbairClientTest < Minitest::Test
  BASE = 'https://api.abair.ie/v4'.freeze

  def client
    AbairClient.new(api_key: 'secret')
  end

  def test_requires_an_api_key
    assert_raises(AbairClient::Error) { AbairClient.new(api_key: '') }
  end

  def test_maps_legacy_voice_names_to_v4_ids
    assert_equal 'anb.piper', AbairClient.voice_id('ga_UL_anb_piper')
    assert_equal 'nnc.piper', AbairClient.voice_id('ga_MU_nnc_piper')
    assert_equal 'donall', AbairClient.voice_id('donall')
  end

  def test_recognise_posts_multipart_audio_with_the_key
    stub = stub_request(:post, "#{BASE}/recognition/batch?captpunct=false")
      .with(headers: { 'abair-api-key' => 'secret', 'Content-Type' => %r{\Amultipart/form-data} })
      .to_return(status: 200, body: { text: 'dia dhuit', captpunct_applied: false }.to_json)

    assert_equal 'dia dhuit', client.recognise('RIFFdata')
    assert_requested stub
  end

  def test_synthesise_posts_json_and_returns_audio
    stub = stub_request(:post, "#{BASE}/synthesis?audioEncoding=WAV&outputType=JSON")
      .with(headers: { 'abair-api-key' => 'secret' }, body: { input: 'Dia dhuit', voice: 'anb.piper', speed: 1.0 }.to_json)
      .to_return(status: 200, body: { audioContent: 'QUJD', normalised_text: 'Dia dhuit' }.to_json)

    assert_equal 'QUJD', client.synthesise('Dia dhuit', voice: 'ga_UL_anb_piper')['audioContent']
    assert_requested stub
  end

  def test_voices
    stub_request(:get, "#{BASE}/synthesis/voices").to_return(status: 200, body: [{ id: 'anb.piper' }].to_json)

    assert_equal [{ 'id' => 'anb.piper' }], client.voices
  end

  def test_maps_error_statuses
    stub_request(:get, "#{BASE}/synthesis/voices").to_return(status: 401, body: { message: 'bad key' }.to_json)
    error = assert_raises(AbairClient::Unauthorized) { client.voices }
    assert_equal 'bad key', error.message

    stub_request(:get, "#{BASE}/synthesis/voices").to_return(status: 429, body: { error: 'Daily balance exhausted' }.to_json)
    assert_raises(AbairClient::QuotaExceeded) { client.voices }

    stub_request(:get, "#{BASE}/synthesis/voices").to_return(status: 500, body: 'oops')
    error = assert_raises(AbairClient::Error) { client.voices }
    assert_equal 500, error.status
  end
end
