Pod::Spec.new do |s|
  s.name           = 'CardOcr'
  s.version        = '1.0.0'
  s.summary        = 'Card-tuned Apple Vision text recognition'
  s.description    = 'Local module: VNRecognizeTextRequest configured for collector codes and card names.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
