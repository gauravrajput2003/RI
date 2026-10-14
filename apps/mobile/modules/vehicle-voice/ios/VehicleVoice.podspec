Pod::Spec.new do |s|
  s.name = 'VehicleVoice'
  s.version = '1.0.0'
  s.summary = 'Prepare vehicle notification sounds on-device'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'RI'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'
  s.source_files = '**/*.swift'
end
