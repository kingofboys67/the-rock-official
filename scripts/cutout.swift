// usage: cutout <in> <out.png> <canvasW> <canvasH> <eyeX> <eyeY> <iod> [cropX cropY cropW cropH]
// Lifts the foreground person onto a transparent canvas (Apple Vision) and scales/places the
// image so both eyes land on the same spot in every era. Prints the detected eye distance.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 8 else { FileHandle.standardError.write("usage: cutout in out cw ch eyeX eyeY iod [crop x y w h]\n".data(using: .utf8)!); exit(2) }
let cw = Double(a[3])!, ch = Double(a[4])!, tx = Double(a[5])!, ty = Double(a[6])!, tiod = Double(a[7])!
guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      var cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("{\"error\":\"load\"}"); exit(1) }
if a.count >= 12, let c = cg.cropping(to: CGRect(x: Double(a[8])!, y: Double(a[9])!, width: Double(a[10])!, height: Double(a[11])!)) { cg = c }
let W = Double(cg.width), H = Double(cg.height)
let handler = VNImageRequestHandler(cgImage: cg, options: [:])

let faceReq = VNDetectFaceLandmarksRequest()
try handler.perform([faceReq])
guard let face = faceReq.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) else { print("{\"error\":\"noface\"}"); exit(1) }
let bb = face.boundingBox
func centre(_ r: VNFaceLandmarkRegion2D?) -> (Double, Double)? {
    guard let r = r, r.pointCount > 0 else { return nil }
    var sx = 0.0, sy = 0.0
    for p in r.normalizedPoints { sx += Double(p.x); sy += Double(p.y) }
    let n = Double(r.pointCount)
    return ((Double(bb.origin.x) + sx / n * Double(bb.width)) * W, (Double(bb.origin.y) + sy / n * Double(bb.height)) * H) // y up
}
guard let le = centre(face.landmarks?.leftEye), let re = centre(face.landmarks?.rightEye) else { print("{\"error\":\"noeyes\"}"); exit(1) }

let maskReq = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([maskReq])
guard let obs = maskReq.results?.first else { print("{\"error\":\"nomask\"}"); exit(1) }
var chosen = obs.allInstances
let inst = obs.instanceMask
CVPixelBufferLockBaseAddress(inst, .readOnly)
if let base = CVPixelBufferGetBaseAddress(inst) {
    let mw = CVPixelBufferGetWidth(inst), mh = CVPixelBufferGetHeight(inst), bpr = CVPixelBufferGetBytesPerRow(inst)
    let mx = min(mw - 1, max(0, Int(Double(bb.midX) * Double(mw)))), my = min(mh - 1, max(0, Int((1 - Double(bb.midY)) * Double(mh))))
    let v = base.advanced(by: my * bpr + mx).assumingMemoryBound(to: UInt8.self).pointee
    if v != 0 { chosen = IndexSet(integer: Int(v)) }
}
CVPixelBufferUnlockBaseAddress(inst, .readOnly)

let cut = try obs.generateMaskedImage(ofInstances: chosen, from: handler, croppedToInstancesExtent: false)
let ci = CIImage(cvPixelBuffer: cut)
let ctx = CIContext()
guard let cutCG = ctx.createCGImage(ci, from: ci.extent) else { print("{\"error\":\"render\"}"); exit(1) }

// place on canvas: eye midpoint -> (tx,ty), inter-ocular distance -> tiod, eye line levelled (head roll removed)
let iod = hypot(le.0 - re.0, le.1 - re.1)
let s = tiod / iod
let (p1, p2) = le.0 < re.0 ? (le, re) : (re, le)
let roll = atan2(p2.1 - p1.1, p2.0 - p1.0) // y-up coordinates
let mid = ((le.0 + re.0) / 2, (le.1 + re.1) / 2)
let space = CGColorSpaceCreateDeviceRGB()
guard let g = CGContext(data: nil, width: Int(cw), height: Int(ch), bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
g.interpolationQuality = .high
g.translateBy(x: tx, y: ch - ty)
g.rotate(by: -roll)
g.scaleBy(x: s, y: s)
g.translateBy(x: -mid.0, y: -mid.1)
g.draw(cutCG, in: CGRect(x: 0, y: 0, width: Double(cutCG.width), height: Double(cutCG.height)))
guard let outCG = g.makeImage() else { exit(1) }
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, outCG, nil)
CGImageDestinationFinalize(dest)
print("{\"iod\":\(Int(iod)),\"scale\":\(Double(Int(s*100))/100),\"rollDeg\":\(Double(Int(roll*1800/Double.pi))/10)}")
