// usage: classify-photos <image>...   ->  one JSON line per image:
//   {"file", "w", "h", "faces", "face" (largest face area / image area), "text" (share of the image covered by text)}
// Used by scripts/build-gallery.py to keep photos of people and drop text graphics (headlines, quote cards, screenshots).
import Foundation
import Vision
import ImageIO

for path in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    let faces = VNDetectFaceRectanglesRequest()
    let text = VNRecognizeTextRequest()
    text.recognitionLevel = .fast
    text.usesLanguageCorrection = false
    try? handler.perform([faces, text])
    let fs = faces.results ?? []
    let largest = fs.map { Double($0.boundingBox.width * $0.boundingBox.height) }.max() ?? 0
    let textArea = (text.results ?? []).reduce(0.0) { $0 + Double($1.boundingBox.width * $1.boundingBox.height) }
    let name = (path as NSString).lastPathComponent
    print("{\"file\":\"\(name)\",\"w\":\(cg.width),\"h\":\(cg.height),\"faces\":\(fs.count),\"face\":\(String(format: "%.4f", largest)),\"text\":\(String(format: "%.4f", min(textArea, 1)))}")
    fflush(stdout)
}
