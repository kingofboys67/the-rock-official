import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func loadRGBA(_ path: String) -> (w: Int, h: Int, data: [UInt8], cg: CGImage)? {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }
    let w = cg.width, h = cg.height
    var data = [UInt8](repeating: 0, count: w * h * 4)
    let space = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: &data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    return (w, h, data, cg)
}

func savePNG(_ path: String, w: Int, h: Int, data: [UInt8]) -> Bool {
    var copy = data
    let space = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: &copy, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let cg = ctx.makeImage(),
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        return false
    }
    CGImageDestinationAddImage(dest, cg, nil)
    return CGImageDestinationFinalize(dest)
}

// Detects left and right eye pupil centers inside the eye sockets so all 4 portraits lock to identical coordinates
func detectEyes(w: Int, h: Int, data: [UInt8]) -> (lx: Double, ly: Double, rx: Double, ry: Double) {
    func findEyePupil(xMin: Int, xMax: Int, yMin: Int, yMax: Int) -> (Double, Double) {
        var bestScore = -1e9
        var bestX = Double(xMin + xMax) / 2.0
        var bestY = Double(yMin + yMax) / 2.0
        for y in yMin...yMax {
            for x in xMin...xMax {
                // Dark iris/pupil core (radius 4)
                var coreLuma = 0.0
                var cCount = 0.0
                for dy in -4...4 {
                    for dx in -4...4 where dx * dx + dy * dy <= 16 {
                        let idx = ((y + dy) * w + (x + dx)) * 4
                        coreLuma += (Double(data[idx]) + Double(data[idx + 1]) + Double(data[idx + 2])) / 3.0
                        cCount += 1.0
                    }
                }
                coreLuma /= cCount
                if coreLuma > 65.0 { continue }
                
                // White sclera to the left (-13..-8) and right (+8..+13) at the same y level
                var scleraL = 0.0, scleraR = 0.0
                for dy in -2...2 {
                    for dx in 8...14 {
                        let idxL = ((y + dy) * w + (x - dx)) * 4
                        let idxR = ((y + dy) * w + (x + dx)) * 4
                        // Sclera has high blue/green channel too (unlike warm skin)
                        let valL = Double(data[idxL + 1]) * 0.5 + Double(data[idxL + 2]) * 0.5
                        let valR = Double(data[idxR + 1]) * 0.5 + Double(data[idxR + 2]) * 0.5
                        scleraL = max(scleraL, valL)
                        scleraR = max(scleraR, valR)
                    }
                }
                // Both sides or at least strong sclera presence must exist (excludes eyebrows!)
                let minSclera = min(scleraL, scleraR)
                let maxSclera = max(scleraL, scleraR)
                if maxSclera < 125.0 { continue }
                let score = minSclera * 1.5 + maxSclera * 1.0 - coreLuma * 2.5
                if score > bestScore {
                    bestScore = score
                    bestX = Double(x)
                    bestY = Double(y)
                }
            }
        }
        // Sub-pixel dark centroid refinement within 6px of bestX, bestY
        var sumW = 0.0, sumX = 0.0, sumY = 0.0
        let bx = Int(bestX), by = Int(bestY)
        for dy in -6...6 {
            for dx in -6...6 where dx * dx + dy * dy <= 36 {
                let px = bx + dx, py = by + dy
                let idx = (py * w + px) * 4
                let luma = (Double(data[idx]) + Double(data[idx + 1]) + Double(data[idx + 2])) / 3.0
                let weight = max(0.0, 80.0 - luma)
                sumW += weight
                sumX += Double(px) * weight
                sumY += Double(py) * weight
            }
        }
        return sumW > 0 ? (sumX / sumW, sumY / sumW) : (bestX, bestY)
    }
    
    let (lx, ly) = findEyePupil(xMin: 432, xMax: 476, yMin: 292, yMax: 368)
    let (rx, ry) = findEyePupil(xMin: 548, xMax: 592, yMin: 292, yMax: 368)
    return (lx, ly, rx, ry)
}

func processPortrait(inPath: String, outPath: String, targetEyeX: Double = 512.0, targetEyeY: Double = 352.0, targetIOD: Double = 132.0) {
    guard var img = loadRGBA(inPath) else {
        fputs("Failed to load \(inPath)\n", stderr)
        exit(1)
    }
    let w = img.w, h = img.h
    
    // First remove the exterior studio background on the original image
    var fgScore = [Float](repeating: 0, count: w * h)
    for i in 0..<(w * h) {
        let r = Float(img.data[i * 4])
        let g = Float(img.data[i * 4 + 1])
        let b = Float(img.data[i * 4 + 2])
        let luma = (r + g + b) / 3.0
        let warmth = max(0.0, (r - b) - 10.0)
        let darkness = max(0.0, 165.0 - luma)
        fgScore[i] = max(warmth * 1.6, darkness * 1.2)
    }
    
    var visited = [Bool](repeating: false, count: w * h)
    var queue = [Int]()
    queue.reserveCapacity(w * h / 2)
    let bgThresh: Float = 26.0
    
    for x in 0..<w {
        if fgScore[x] < bgThresh {
            visited[x] = true
            queue.append(x)
        }
    }
    for y in 0..<h {
        let l = y * w
        if !visited[l] && fgScore[l] < bgThresh {
            visited[l] = true
            queue.append(l)
        }
        let r = y * w + (w - 1)
        if !visited[r] && fgScore[r] < bgThresh {
            visited[r] = true
            queue.append(r)
        }
    }
    
    var head = 0
    while head < queue.count {
        let curr = queue[head]
        head += 1
        let cx = curr % w, cy = curr / w
        let nbs = [
            cx > 0 ? curr - 1 : -1,
            cx + 1 < w ? curr + 1 : -1,
            cy > 0 ? curr - w : -1,
            cy + 1 < h ? curr + w : -1
        ]
        for nb in nbs where nb >= 0 && !visited[nb] {
            if fgScore[nb] < bgThresh {
                visited[nb] = true
                queue.append(nb)
            }
        }
    }
    
    var band = visited
    for _ in 0..<3 {
        var next = band
        for y in 1..<(h - 1) {
            for x in 1..<(w - 1) {
                let i = y * w + x
                if !band[i] && (band[i - 1] || band[i + 1] || band[i - w] || band[i + w]) {
                    next[i] = true
                }
            }
        }
        band = next
    }
    
    var alpha = [Float](repeating: 1.0, count: w * h)
    let lowT: Float = 16.0
    let highT: Float = 44.0
    for i in 0..<(w * h) {
        if visited[i] && fgScore[i] < lowT {
            alpha[i] = 0.0
        } else if band[i] {
            let s = fgScore[i]
            if s <= lowT {
                alpha[i] = 0.0
            } else if s < highT {
                let t = (s - lowT) / (highT - lowT)
                alpha[i] = t * t * (3.0 - 2.0 * t)
            }
        }
    }
    
    for _ in 0..<2 {
        var next = alpha
        for y in 1..<(h - 1) {
            for x in 1..<(w - 1) {
                let i = y * w + x
                if band[i] {
                    var sum: Float = 0
                    for dy in -1...1 {
                        for dx in -1...1 {
                            sum += alpha[(y + dy) * w + (x + dx)]
                        }
                    }
                    next[i] = sum / 9.0
                }
            }
        }
        alpha = next
    }
    
    // Detect exact eye coordinates before modifying pixel buffer
    let eyes = detectEyes(w: w, h: h, data: img.data)
    let midX = (eyes.lx + eyes.rx) * 0.5
    let midY = (eyes.ly + eyes.ry) * 0.5
    let iod = hypot(eyes.rx - eyes.lx, eyes.ry - eyes.ly)
    let scale = targetIOD / iod
    
    for i in 0..<(w * h) {
        let a = Double(alpha[i])
        if a <= 0.01 {
            img.data[i * 4] = 0
            img.data[i * 4 + 1] = 0
            img.data[i * 4 + 2] = 0
            img.data[i * 4 + 3] = 0
        } else if a < 0.995 {
            let r = Double(img.data[i * 4])
            let g = Double(img.data[i * 4 + 1])
            let b = Double(img.data[i * 4 + 2])
            let bgLuma = max(180.0, (r + g + b) / 3.0)
            let fgR = min(255.0, max(0.0, (r - bgLuma * (1.0 - a)) / a))
            let fgG = min(255.0, max(0.0, (g - bgLuma * (1.0 - a)) / a))
            let fgB = min(255.0, max(0.0, (b - bgLuma * (1.0 - a)) / a))
            img.data[i * 4] = UInt8(clamping: Int((fgR * a).rounded()))
            img.data[i * 4 + 1] = UInt8(clamping: Int((fgG * a).rounded()))
            img.data[i * 4 + 2] = UInt8(clamping: Int((fgB * a).rounded()))
            img.data[i * 4 + 3] = UInt8(clamping: Int((a * 255.0).rounded()))
        }
    }
    
    // Render cutout onto output canvas with exact eye alignment (targetEyeX, targetEyeY) and scale (targetIOD)
    let space = CGColorSpaceCreateDeviceRGB()
    guard let srcCtx = CGContext(
        data: &img.data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let cutCG = srcCtx.makeImage() else { exit(1) }
    
    var outData = [UInt8](repeating: 0, count: w * h * 4)
    guard let dstCtx = CGContext(
        data: &outData, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
        space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { exit(1) }
    dstCtx.interpolationQuality = .high
    // In CGContext, origin (0,0) is bottom-left, so y_cg = Double(h) - y_top
    let targetCGY = Double(h) - targetEyeY
    let midCGY = Double(h) - midY
    dstCtx.translateBy(x: targetEyeX, y: targetCGY)
    dstCtx.scaleBy(x: scale, y: scale)
    dstCtx.translateBy(x: -midX, y: -midCGY)
    dstCtx.draw(cutCG, in: CGRect(x: 0, y: 0, width: Double(w), height: Double(h)))
    
    _ = savePNG(outPath, w: w, h: h, data: outData)
    print(String(format: "Saved aligned cutout: %@ | eyes=(%.1f, %.1f)-(%.1f, %.1f) mid=(%.1f, %.1f) iod=%.1f scale=%.3f",
                 outPath, eyes.lx, eyes.ly, eyes.rx, eyes.ry, midX, midY, iod, scale))
}

let args = CommandLine.arguments
if args.count >= 3 {
    processPortrait(inPath: args[1], outPath: args[2])
}
