ENV['APP_ENV'] = 'test'
ENV['RACK_ENV'] = 'test'
ENV['ABAIR_API_KEY'] = 'test-abair-key'
ENV['OPENAI_KEY'] = 'test-openai-key'
ENV.delete('APP_API_KEY')

require 'minitest/autorun'
require 'rack/test'
require 'webmock/minitest'
require 'base64'
require 'json'
