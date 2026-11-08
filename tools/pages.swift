// Usage: pages <pdf> <outdir> [word1,word2]
// Writes s<i>.jpg (thumb) + b<i>.jpg (zoom), prints JSON: page sizes + pages still containing a forbidden word.
import AppKit
import PDFKit

let a = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { fatalError("cannot open \(a[1])") }
let words = a.count > 3 ? a[3].split(separator: ",").map { String($0).lowercased() } : []

func jpg(_ p: PDFPage, _ box: CGFloat, _ path: String, _ q: Double) {
    let img = p.thumbnail(of: NSSize(width: box, height: box), for: .mediaBox)
    let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
    try! rep.representation(using: .jpeg, properties: [.compressionFactor: q])!
        .write(to: URL(fileURLWithPath: path))
}

var pages: [String] = []
var bad: [Int] = []
for i in 0..<doc.pageCount {
    let p = doc.page(at: i)!
    let r = p.bounds(for: .mediaBox)
    pages.append("[\(Int(r.width)),\(Int(r.height))]")
    let text = (p.string ?? "").lowercased()
    if words.contains(where: { text.contains($0) }) { bad.append(i) }
    jpg(p, 400, "\(a[2])/s\(i).jpg", 0.6)
    jpg(p, 1600, "\(a[2])/b\(i).jpg", 0.45)
}
print("{\"pages\":[\(pages.joined(separator: ","))],\"bad\":\(bad)}")
