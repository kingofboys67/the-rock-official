// usage: landmarks <image>  ->  JSON of face landmark regions in pixel coords (origin top-left)
import Foundation
import Vision
import ImageIO

guard CommandLine.arguments.count == 2,
      let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("{\"error\":\"load\"}"); exit(1) }
let size = CGSize(width: cg.width, height: cg.height)
let req = VNDetectFaceLandmarksRequest()
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
guard let face = req.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }), let lm = face.landmarks else { print("{\"error\":\"noface\"}"); exit(1) }
func pts(_ r: VNFaceLandmarkRegion2D?) -> String {
    guard let r = r else { return "[]" }
    return "[" + r.pointsInImage(imageSize: size).map { "[\(Double($0.x)),\(Double(size.height) - Double($0.y))]" }.joined(separator: ",") + "]"
}
let regions: [(String, VNFaceLandmarkRegion2D?)] = [
    ("faceContour", lm.faceContour), ("leftEye", lm.leftEye), ("rightEye", lm.rightEye),
    ("leftEyebrow", lm.leftEyebrow), ("rightEyebrow", lm.rightEyebrow), ("nose", lm.nose),
    ("noseCrest", lm.noseCrest), ("medianLine", lm.medianLine), ("outerLips", lm.outerLips),
    ("innerLips", lm.innerLips), ("leftPupil", lm.leftPupil), ("rightPupil", lm.rightPupil)]
print("{" + regions.map { "\"\($0.0)\":\(pts($0.1))" }.joined(separator: ",") + "}")
