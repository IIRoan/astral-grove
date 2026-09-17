# iOS card scanning: implementation and model research

Reviewed 17 September 2026.

## Recommendation

Keep Apple Vision for the current development build. The app already performs on-device machine learning: `VNGenerateImageFeaturePrintRequest` embeds both the catalog artwork and the camera crop, then the native matcher compares their normalized vectors. OCR supplies the collector code and name. Camera frames are not uploaded for inference; the reference catalog and artwork must first be downloaded and cached.

Apple documents feature prints specifically for image similarity. Our implementation uses cosine similarity over extracted floats; Apple's sample uses feature-print distance. Neither approach has yet been benchmarked on physical Riftbound cards in this project. Changing the metric or model requires recalibrating the acceptance thresholds. [Apple image similarity documentation](https://developer.apple.com/documentation/vision/analyzing-image-similarity-with-feature-print)

For this catalog, my recommendation is image retrieval plus OCR: new artwork can be indexed without retraining a classifier, while the collector code distinguishes printings that share a picture. A model cannot reliably infer a printing or finish from identical reference art. Confirmation remains mandatory and Yes adds the normal finish only.

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

## Changes in this branch

- Capture: 30 fps target, supported low-light boost, torch control, and correct mapping from the preview guide to the oriented camera buffer.
- Difficult layouts: full-guide fallback when card edges disappear; shadow/contrast OCR retry; split title/footer parsing, including Lux, Crownguard (`OGS-014`, printed `014/024`).
- Temporal evidence: uncertain card decisions require two agreeing reads, artwork alone three, and ambiguous printings six. A brief unreadable frame is tolerated. A different card or printing-option set, two consecutive misses, or a gap over 1.5 seconds resets evidence. Votes older than five seconds expire. Agreement between code and artwork can prompt immediately, but still requires Yes.
- Resource use: reference embedding concurrency is reduced from six to two to limit competition with live recognition. Device measurements are still needed to quantify the effect.
- Native structure: `CardImageProcessing.swift` handles cropping and perspective; `CardArtMatcher.swift` owns embeddings and the index; `CardTextRecognizer.swift` handles OCR and enhancement. `HybridCardOcrFrame.swift` coordinates the native bridge. The refactor preserves image and embedding preprocessing.
- Distribution: the `iOS development build` workflow builds the development profile locally on GitHub's macOS runner and uploads the IPA to Expo. It does not create a GitHub release or submit to the App Store.

## Evaluation before replacing the model

Use the same held-out capture sessions for the current scanner and each candidate. Include Lux OGS-014, other full-art cards, visually similar cards, shared-art printings, landscape cards, and unknown/non-card objects. Capture upright and tilted cards under bright light, dim warm light, uneven shadows, and sleeve glare; repeat on an older supported iPhone and a recent device. Keep training and test sessions separate, including their derived augmentations.

Measure correct printing suggestions, incorrect suggestions, abstentions, time to confirmation (median and p95), preview responsiveness, memory, and sustained thermal behavior. Report cold index-building sessions separately from a warm cached index. A visually similar but wrong printing counts as incorrect.

The acceptance criterion should be fewer incorrect suggestions and better dim-light recall without worsening preview responsiveness. Select thresholds on validation captures and report the final held-out results. Until those measurements exist, no model swap or latency/accuracy improvement is proven. The automated regression tests cover evidence handling, confirmation, parsing and crop geometry; they cannot establish physical camera accuracy.
