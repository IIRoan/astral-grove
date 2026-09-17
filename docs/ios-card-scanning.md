# iOS card scanning: implementation and model research

Reviewed 17 September 2026.

## Current camera pipeline

The default scanner now uses collector-code OCR exclusively. It no longer identifies a card from its title, rules text, or whole-card image similarity. Apple Vision's accurate text-recognition model reads a physical crop of the bottom 16% of the card directly from the camera pixel buffer. No photo capture, JPEG encoding, camera-frame upload, or reference-art download is needed. The model remains Apple's on-device model; this is a different recognition pipeline, not a newly trained Riftbound model.

The frame output requests 1080p instead of the previous 720p default. A native serial worker crops to the preview guide, locates and straightens the card using a 640px detection image, and enlarges only the footer for accurate OCR. One OCR request runs per accepted frame. Failed reads schedule a contrast-enhanced crop and alternative orientation on subsequent frames. Apple Vision document segmentation is tried during recovery for difficult borders. The camera supports native tap-to-focus and optional torch/low-light boost where supported.

The catalog parser accepts only a known collector identifier, including split set/number observations and constrained OCR glyph corrections. Conflicting valid identifiers abstain. Two agreeing scans are required before the confirmation prompt. Yes still adds one normal copy and keeps the camera open. Printings without a readable collector identifier cannot be resolved by name in this mode.

The photo compatibility path also reads only the footer. Legacy artwork bridge methods remain for binary compatibility but are absent from the active recognition path.

Apple describes restricting live OCR to a region of interest for responsiveness, and document segmentation supplies document corner coordinates. These APIs support the implementation, but they do not establish accuracy or latency on physical Riftbound cards. [Apple live-camera OCR sample](https://developer.apple.com/documentation/Vision/extracting-phone-numbers-from-text-in-images), [Apple document segmentation](https://developer.apple.com/documentation/vision/vndetectdocumentsegmentationrequest).

The macOS workflow compiles the native pipeline and runs real Vision OCR against a rendered fixture containing different valid-looking codes in the footer and body, plus a dimmed version. It also tests recovery scheduling. This proves crop isolation and basic native OCR operation, not real-camera glare handling or a device latency target. The development overlay reports locate + OCR timings for that evaluation.

## Earlier artwork model research

The previous pipeline used `VNGenerateImageFeaturePrintRequest` and cosine similarity before OCR. That broad similarity lookup was expensive and could leave text in the card body driving the result. It is no longer used by the scanner. The alternatives below remain research options for a future measured artwork fallback.

## Models considered

| Option                              | Fit for this app                                                                                                                                                                              | Decision                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Apple Vision feature prints + OCR   | Already integrated; runs locally; no additional model download.                                                                                                                               | Improve capture and evidence handling first, then measure the baseline.                        |
| Create ML / Core ML card classifier | A card-specific model can learn our camera conditions, but needs representative labeled photos and retraining for new classes.                                                                | A reasonable next experiment after collecting real scans.                                      |
| MobileCLIP / MobileCLIP2            | Mobile-oriented image encoders are technically relevant, but the published model license restricts use to noncommercial research and explicitly excludes product development.                 | Do not ship or integrate these weights under that license.                                     |
| SigLIP 2 Base                       | Google's model card provides image embeddings and lists Apache-2.0 licensing. This is a larger alternative to evaluate, not evidence of better card recognition or acceptable iPhone latency. | Optional comparison model; convert the image encoder and profile before considering inclusion. |

Sources: [Apple Create ML](https://developer.apple.com/documentation/createml/creating-an-image-classifier-model), [MobileCLIP models and code](https://github.com/apple-aiml-research/ml-mobileclip), [MobileCLIP model license](https://github.com/apple-aiml-research/ml-mobileclip/blob/main/LICENSE_MODELS), [Google SigLIP 2 model card](https://huggingface.co/google/siglip2-base-patch16-224).

Apple recommends diverse lighting and angles, at least ten images per class, and separate testing images. Ten is a starting minimum, not a guarantee of useful accuracy on fine-grained card printings. A clean catalog image with synthetic darkening alone does not establish real-camera performance. [Create ML training guidance](https://developer.apple.com/documentation/createml/creating-an-image-classifier-model)

Core ML supports image inputs and tensor outputs, which fits a replacement embedding model. Keep the reference and camera preprocessing identical, version the model and preprocessing together, rebuild the cached index, and retain OCR and the explicit confirmation step. [Core ML input/output documentation](https://apple.github.io/coremltools/docs-guides/source/model-input-and-output-types.html)

### Development upload labels

`eas upload` does not copy the profile, channel, or commit from the local build. The existing upload was a development client but lacked these labels; EAS rejected attempts to update its metadata afterward. `scripts/upload-development-build.cjs` wraps the pinned EAS CLI 24.6.0 upload command and adds development metadata to its `createLocalBuildAsync` call. It retains the CLI's authentication, artifact upload, and JSON install URL output, and checks the returned profile, channel, and commit before reporting success.

This adapter uses a CLI internal API. Keep the workflow's version pin and adapter version check aligned, rerun the adapter tests, and verify a real upload when upgrading it. The update channel remains `development`; the Git source stays the actual PR branch and is included in the build message. No Git branch is renamed.

## Evaluation before replacing the model

Use the same held-out capture sessions for the current scanner and each candidate. Include Lux OGS-014, other full-art cards, visually similar cards, shared-art printings, landscape cards, and unknown/non-card objects. Capture upright and tilted cards under bright light, dim warm light, uneven shadows, and sleeve glare; repeat on an older supported iPhone and a recent device. Keep training and test sessions separate, including their derived augmentations.

Measure correct printing suggestions, incorrect suggestions, abstentions, time to confirmation (median and p95), preview responsiveness, memory, and sustained thermal behavior. Report cold index-building sessions separately from a warm cached index. A visually similar but wrong printing counts as incorrect.

The acceptance criterion should be fewer incorrect suggestions and better dim-light recall without worsening preview responsiveness. Select thresholds on validation captures and report the final held-out results. Until those measurements exist, no model swap or latency/accuracy improvement is proven. The automated regression tests cover evidence handling, confirmation, parsing and crop geometry; they cannot establish physical camera accuracy.
