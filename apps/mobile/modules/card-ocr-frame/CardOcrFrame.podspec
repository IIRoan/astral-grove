Pod::Spec.new do |s|
  s.name           = 'CardOcrFrame'
  s.version        = '1.0.0'
  s.summary        = 'Apple Vision text recognition on VisionCamera frames'
  s.description    = 'Reads a camera frame pixel buffer directly, with no photo capture.'
  s.author         = ''
  s.homepage       = 'https://github.com/IIRoan/astral-grove'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.source_files = 'ios/**/*.{swift,h,hpp,m,mm,cpp}'

  s.dependency 'VisionCamera'

  # Pulls in the nitrogen-generated bridges and sets the C++/Swift interop flags.
  load 'nitrogen/generated/ios/CardOcrFrame+autolinking.rb'
  add_nitrogen_files(s)
end
