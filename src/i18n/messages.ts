/**
 * Pattern-based Vietnamese translation for generated messages (validator, Auto Fix,
 * export preflight/report, quality checker, layout assistant, chart suggestions).
 * Messages are produced in English; translation happens at render time.
 *
 * Resolution order in translateMessage():
 *   1. STATIC exact match
 *   2. location prefix ("Slide 3 › element 2 (id): …") → translated prefix + recursive translation of the rest
 *   3. MESSAGE_PATTERNS (first match wins); templates are strings ($1..$n) or functions
 * Unmatched messages are returned in English.
 */
import { REGISTRY } from './vi/registry';

type Tpl = string | ((...groups: string[]) => string);

/** Translate a registry label if known (e.g. "Video Embed" → "Nhúng video"). */
const L = (s: string) => REGISTRY[s] ?? s;

const STATIC: Record<string, string> = {
  // parser / import
  'Paste presentation code first.': 'Hãy dán mã bài thuyết trình trước.',
  'Could not detect the code format. Supported: SlideCraft JSON, JS object, TSX, HTML, Markdown.': 'Không nhận diện được định dạng mã. Hỗ trợ: SlideCraft JSON, đối tượng JS, TSX, HTML, Markdown.',
  'JSON contains comments — they were ignored.': 'JSON có chú thích — đã được bỏ qua.',
  'Trailing commas were tolerated.': 'Đã chấp nhận dấu phẩy thừa ở cuối.',
  'Removed markdown code fence.': 'Đã gỡ khối rào mã markdown (```).',
  'Empty or invalid JSON document.': 'Tài liệu JSON trống hoặc không hợp lệ.',
  'Root must be a presentation object with "schemaVersion", "title" and "slides".': 'Gốc phải là đối tượng presentation có "schemaVersion", "title" và "slides".',
  'No <Presentation> root element found. Wrap slides in <Presentation>…</Presentation>.': 'Không tìm thấy phần tử gốc <Presentation>. Hãy bọc các slide trong <Presentation>…</Presentation>.',
  'No presentation object found. Use `export default { schemaVersion: "1.0", ... }`.': 'Không tìm thấy đối tượng presentation. Hãy dùng `export default { schemaVersion: "1.0", ... }`.',
  'Function calls are not allowed (only .map/.filter/.slice and a few pure helpers).': 'Không cho phép gọi hàm (chỉ .map/.filter/.slice và vài hàm thuần an toàn).',
  'Only inline arrow functions are supported in .map().': 'Trong .map() chỉ hỗ trợ hàm mũi tên viết trực tiếp.',
  'Object methods are not allowed in presentation data.': 'Không cho phép phương thức đối tượng trong dữ liệu bài thuyết trình.',
  'Prototype access is not allowed.': 'Không cho phép truy cập prototype.',
  'Source is too complex to evaluate statically (step limit reached).': 'Mã nguồn quá phức tạp để phân tích tĩnh (vượt giới hạn bước).',
  'HTML import requires a DOM parser (available in the browser).': 'Nhập HTML cần trình phân tích DOM (có sẵn trong trình duyệt).',
  'No slides found. Use <section> per slide.': 'Không tìm thấy slide. Hãy dùng một <section> cho mỗi slide.',
  'No slides found in Markdown.': 'Không tìm thấy slide trong Markdown.',
  'Morph on the first slide has nothing to morph from.': 'Morph ở slide đầu tiên không có slide nào trước để chuyển từ đó.',
  // auto fix
  'Added missing presentation title.': 'Đã thêm tiêu đề bài thuyết trình còn thiếu.',
  'Wrapped a bare slides array in a presentation object.': 'Đã bọc mảng slide trần vào một đối tượng presentation.',
  'Unwrapped "presentation" root object.': 'Đã gỡ lớp đối tượng gốc "presentation".',
  // export report: check names & details
  'Animations & transitions classified': 'Đã phân loại animation & hiệu ứng chuyển slide',
  Charts: 'Biểu đồ', Fonts: 'Phông chữ', Images: 'Hình ảnh', 'Slide size': 'Kích thước slide', 'Text overflow': 'Tràn chữ',
  'Elements inside canvas': 'Phần tử nằm trong khung slide', 'Transition sound': 'Âm thanh chuyển slide',
  'all resolved': 'đã có đủ', 'none detected': 'không phát hiện', ok: 'ổn', OK: 'ổn',
  'Code block → native text box with syntax colors': 'Khối mã → hộp văn bản gốc có tô màu cú pháp',
  'Decorative visuals → vector picture (not editable shapes)': 'Hình trang trí → ảnh vector (không phải hình khối chỉnh sửa được)',
  '3D-like visuals → vector picture (not editable shapes)': 'Hình giả 3D → ảnh vector (không phải hình khối chỉnh sửa được)',
  'Diagram → grouped native shapes': 'Sơ đồ → nhóm hình khối gốc',
  'Infographic → grouped native shapes': 'Infographic → nhóm hình khối gốc',
  'Timeline → grouped native shapes': 'Dòng thời gian → nhóm hình khối gốc',
  'Gradient background → native gradient fill': 'Nền dải màu → tô dải màu gốc',
  'Group → native group': 'Nhóm → nhóm gốc',
  'Icon → SVG picture': 'Biểu tượng → ảnh SVG',
  'SVG → SVG picture': 'SVG → ảnh SVG',
  'Line/Arrow → native line': 'Đường thẳng/Mũi tên → đường thẳng gốc',
  'Shape → native shape': 'Hình khối → hình khối gốc',
  'Table → native table': 'Bảng → bảng gốc',
  'Text → native text box': 'Văn bản → hộp văn bản gốc',
  'Motion path arcs → straight segments': 'Cung trong đường chuyển động → các đoạn thẳng',
  'Donut center label → not shown in native chart': 'Nhãn giữa biểu đồ vành khuyên → không hiển thị trong biểu đồ gốc',
  'YouTube video → online video (requires internet & PowerPoint 2013+)': 'Video YouTube → video trực tuyến (cần Internet & PowerPoint 2013+)',
  'Image → native picture': 'Hình ảnh → ảnh gốc',
  'Speaker notes → native notes': 'Ghi chú người trình bày → ghi chú gốc',
  'Transition sounds are not exported': 'Âm thanh chuyển slide không được xuất',
  // quality checker
  Layout: 'Bố cục', Typography: 'Kiểu chữ', 'Visual Hierarchy': 'Phân cấp thị giác', Color: 'Màu sắc', 'Content Density': 'Mật độ nội dung', Consistency: 'Tính nhất quán',
  'Add a "source" so the audience can trust the data.': 'Thêm "nguồn" để người xem tin vào số liệu.',
  'Add a clear message or remove the slide.': 'Thêm một thông điệp rõ ràng hoặc xóa slide này.',
  'Add a dark overlay (≥35%), a text shadow or a solid backing shape.': 'Thêm lớp phủ tối (≥35%), bóng chữ hoặc một hình nền đặc phía sau chữ.',
  'Add a key number, image or diagram, or enlarge the main message.': 'Thêm một con số chính, hình ảnh hoặc sơ đồ, hoặc phóng to thông điệp chính.',
  'Add a short headline that states the takeaway.': 'Thêm một tiêu đề ngắn nêu rõ kết luận.',
  'Aim for under ~60 words; move detail to speaker notes or a second slide.': 'Nên dưới ~60 từ; chuyển chi tiết sang ghi chú hoặc một slide khác.',
  'All text uses the same size — nothing stands out.': 'Mọi chữ cùng một cỡ — không có gì nổi bật.',
  'Balance with an image, whitespace or a visual on the other side (unless intentional).': 'Cân bằng bằng ảnh, khoảng trắng hoặc yếu tố hình ảnh ở phía bên kia (trừ khi cố ý).',
  'Body text is larger than the heading.': 'Chữ nội dung lớn hơn tiêu đề.',
  'Chart has neither axes nor data labels.': 'Biểu đồ không có trục lẫn nhãn dữ liệu.',
  'Chart has no data source.': 'Biểu đồ không có nguồn dữ liệu.',
  'Chart has no title and the slide has no heading.': 'Biểu đồ không có tiêu đề và slide cũng không có tiêu đề.',
  'Darken the text or lighten the background (WCAG AA).': 'Làm chữ tối hơn hoặc nền sáng hơn (chuẩn WCAG AA).',
  'Describe the image for accessibility.': 'Mô tả hình ảnh để hỗ trợ người khiếm thị.',
  'Enlarge the box, shorten the text or split the slide.': 'Mở rộng hộp chữ, rút gọn nội dung hoặc tách slide.',
  'Image has no alt text.': 'Hình ảnh không có văn bản thay thế (alt).',
  'Keep a consistent outer margin (≈80–120px at 1080p).': 'Giữ lề ngoài thống nhất (≈80–120px ở độ phân giải 1080p).',
  'Keep headlines under ~12 words; move detail into body text or notes.': 'Giữ tiêu đề dưới ~12 từ; chuyển chi tiết vào nội dung hoặc ghi chú.',
  'Limit to 3–6 bullets, or convert to a diagram / card grid.': 'Giới hạn 3–6 gạch đầu dòng, hoặc chuyển thành sơ đồ / lưới thẻ.',
  'Make the key message at least 1.5× larger than body text.': 'Làm thông điệp chính lớn hơn chữ nội dung ít nhất 1,5 lần.',
  'Multi-series chart without a legend.': 'Biểu đồ nhiều chuỗi dữ liệu nhưng không có chú giải.',
  'No focal point — no large text, image or visual.': 'Không có điểm nhấn — không có chữ lớn, hình ảnh hay yếu tố trực quan.',
  'No heading — the slide has no clear entry point.': 'Không có tiêu đề — slide thiếu điểm bắt đầu rõ ràng.',
  'Pick a relevant image in the Media panel or upload your own.': 'Chọn ảnh phù hợp trong bảng Phương tiện hoặc tải ảnh của bạn lên.',
  'Reserve the largest size for the main message.': 'Dành cỡ chữ lớn nhất cho thông điệp chính.',
  'Separate them or align them on a grid.': 'Tách chúng ra hoặc căn chúng theo lưới.',
  'Show axis or value labels so numbers can be read.': 'Hiển thị trục hoặc nhãn giá trị để người xem đọc được số liệu.',
  'Show the legend or label series directly.': 'Hiển thị chú giải hoặc ghi nhãn trực tiếp cho từng chuỗi.',
  'Slide is empty.': 'Slide trống.',
  'State what the chart proves in a headline.': 'Nêu điều biểu đồ chứng minh bằng một tiêu đề.',
  'Stick to theme colors: one accent for emphasis.': 'Dùng màu của theme: chỉ một màu nhấn để làm nổi bật.',
  'Text is closer than 24px to the slide edge.': 'Chữ cách mép slide chưa tới 24px.',
  'Text likely overflows its box and may be cut off.': 'Chữ có thể tràn khỏi hộp và bị cắt mất.',
  'Text sits directly on an image; readability depends on the photo.': 'Chữ nằm trực tiếp trên ảnh; độ dễ đọc phụ thuộc vào bức ảnh.',
  'Use at least 18–20px for readable body text when projected.': 'Dùng cỡ chữ tối thiểu 18–20px để dễ đọc khi trình chiếu.',
  'Use one heading and one body font (theme fonts).': 'Dùng một phông tiêu đề và một phông nội dung (phông của theme).',
  'Use the theme heading + body fonts only.': 'Chỉ dùng phông tiêu đề + phông nội dung của theme.',
  'Visual weight is concentrated on the left.': 'Trọng lượng thị giác dồn về bên trái.',
  'Visual weight is concentrated on the right.': 'Trọng lượng thị giác dồn về bên phải.',
  // layout assistant
  'Add at least 2 bullet points to convert into an infographic.': 'Cần ít nhất 2 gạch đầu dòng để chuyển thành infographic.',
  'Adds an image chosen from the slide topic (resolved via image search).': 'Thêm ảnh theo chủ đề slide (tìm qua công cụ tìm ảnh).',
  'All points kept, arranged in two balanced columns.': 'Giữ nguyên mọi ý, sắp thành hai cột cân đối.',
  'All text meets WCAG AA against its background.': 'Mọi chữ đều đạt chuẩn WCAG AA so với nền.',
  'Bar chart': 'Biểu đồ thanh',
  'Big statistics': 'Số liệu lớn',
  'Body paragraph moved to speaker notes': 'Đoạn nội dung đã chuyển sang ghi chú người trình bày',
  'Bullets must look like “Label: 42” to build a chart. Data is never invented.': 'Gạch đầu dòng phải có dạng “Nhãn: 42” để tạo biểu đồ. Không bao giờ tự bịa số liệu.',
  'Card grid': 'Lưới thẻ',
  'Center composition': 'Căn giữa bố cục',
  'Centers the content block optically on the slide.': 'Căn giữa khối nội dung trên slide theo cảm nhận thị giác.',
  'Clear type scale': 'Thang cỡ chữ rõ ràng',
  'Column chart': 'Biểu đồ cột',
  'Contrast is OK': 'Độ tương phản ổn',
  'Dated points become milestones.': 'Các ý có mốc thời gian trở thành cột mốc.',
  'Donut chart': 'Biểu đồ vành khuyên',
  'Each bullet must start with a date or period, e.g. “2024: Launch”. Content was not changed.': 'Mỗi gạch đầu dòng phải bắt đầu bằng ngày hoặc giai đoạn, ví dụ “2024: Ra mắt”. Nội dung không bị thay đổi.',
  'Horizontal bars for longer labels.': 'Thanh ngang cho nhãn dài.',
  'Horizontal timeline': 'Dòng thời gian ngang',
  'Keep the key sentence': 'Giữ câu chính',
  'First sentence stays on the slide; the rest moves to speaker notes.': 'Câu đầu tiên giữ trên slide; phần còn lại chuyển sang ghi chú người trình bày.',
  'Sentences → bullets': 'Câu → gạch đầu dòng',
  'Each sentence becomes a short bullet.': 'Mỗi câu trở thành một gạch đầu dòng ngắn.',
  'Makes the headline dominant and secondary text quieter.': 'Làm tiêu đề nổi bật, chữ phụ nhẹ nhàng hơn.',
  'Milestones stacked top to bottom.': 'Các cột mốc xếp từ trên xuống dưới.',
  'No dates found': 'Không tìm thấy mốc thời gian',
  'No numeric data found': 'Không tìm thấy dữ liệu số',
  'Not enough points': 'Chưa đủ ý',
  'Numbers in the bullets become a column chart (values unchanged).': 'Các con số trong gạch đầu dòng trở thành biểu đồ cột (giữ nguyên giá trị).',
  'Numbers shown as large stat blocks.': 'Các con số hiển thị thành khối số liệu lớn.',
  'Only the first 4 numbers fit; others moved to notes': 'Chỉ đủ chỗ cho 4 con số đầu; số còn lại chuyển sang ghi chú',
  'Re-aligns all elements to the layout grid and margins.': 'Căn lại mọi phần tử theo lưới bố cục và lề.',
  'Re-applies the layout so all sizes follow the theme type scale.': 'Áp dụng lại bố cục để mọi cỡ chữ theo thang chữ của theme.',
  'Rebuild with layout scale': 'Dựng lại theo thang bố cục',
  'Snap to layout grid': 'Bám theo lưới bố cục',
  'Split into two columns': 'Tách thành hai cột',
  'Text colors adjusted to meet WCAG AA (4.5:1).': 'Màu chữ đã được chỉnh để đạt chuẩn WCAG AA (4.5:1).',
  'Text density is fine': 'Mật độ chữ ổn',
  'Top 5 points': '5 ý quan trọng nhất',
  'Turns each point into a card.': 'Biến mỗi ý thành một thẻ.',
  'Values add up to 100% — shown as shares.': 'Các giá trị cộng lại bằng 100% — hiển thị dưới dạng tỷ trọng.',
  'Vertical timeline': 'Dòng thời gian dọc',
  // chart suggestions
  'A line needs at least 3 points to show a trend.': 'Biểu đồ đường cần ít nhất 3 điểm để thể hiện xu hướng.',
  'Categories are time periods — a line chart shows the trend over time.': 'Các nhóm là mốc thời gian — biểu đồ đường thể hiện xu hướng theo thời gian.',
  'Comparing values across a few categories works best as columns.': 'So sánh giá trị giữa một vài nhóm phù hợp nhất với biểu đồ cột.',
  'Long category labels fit better on a horizontal bar chart.': 'Nhãn nhóm dài hiển thị tốt hơn trên biểu đồ thanh ngang.',
  'Many categories read better as horizontal bars.': 'Nhiều nhóm sẽ dễ đọc hơn với thanh ngang.',
  'Numeric x/y pairs show correlation best as a scatter plot.': 'Các cặp số x/y thể hiện tương quan tốt nhất bằng biểu đồ phân tán.',
  'Pie/donut cannot show negative values.': 'Biểu đồ tròn/vành khuyên không thể hiển thị giá trị âm.',
  'Pie/donut shows only one series — use a column chart to compare series.': 'Biểu đồ tròn/vành khuyên chỉ hiển thị một chuỗi — hãy dùng biểu đồ cột để so sánh các chuỗi.',
  'Points have x, y and size — a bubble chart shows all three.': 'Các điểm có x, y và kích thước — biểu đồ bong bóng thể hiện cả ba.',
  'Values add up to a whole (100%) — a donut shows each share clearly.': 'Các giá trị cộng lại thành tổng thể (100%) — biểu đồ vành khuyên thể hiện rõ từng phần.',
  'Values shrink stage by stage — a funnel shows conversion.': 'Giá trị giảm dần qua từng giai đoạn — biểu đồ phễu thể hiện tỷ lệ chuyển đổi.',
};

/** zod validation messages (after a JSON path). */
function zodMsg(m: string): string | null {
  let r: RegExpExecArray | null;
  if ((r = /^Invalid option: expected one of ([\s\S]+)$/.exec(m))) return `Giá trị không hợp lệ: phải là một trong ${r[1]}`;
  if ((r = /^Invalid input: expected (\w+), received (\w+)$/.exec(m))) return `Dữ liệu không hợp lệ: cần ${r[1]}, nhận được ${r[2]}`;
  if (m === 'Invalid input') return 'Dữ liệu không hợp lệ';
  if ((r = /^Too small: expected (\w+) to have ([<>=]+\s?\d+) (items|characters)$/.exec(m))) return `Quá nhỏ: ${r[1]} cần có ${r[2]} ${r[3] === 'items' ? 'phần tử' : 'ký tự'}`;
  if ((r = /^Too big: expected (\w+) to (?:have|be) ([<>=]+\s?\d+)(?: (items|characters))?$/.exec(m))) return `Quá lớn: ${r[1]} phải ${r[2]}${r[3] ? (r[3] === 'items' ? ' phần tử' : ' ký tự') : ''}`;
  if ((r = /^Too small: expected (\w+) to be ([<>=]+\s?[\d.]+)$/.exec(m))) return `Quá nhỏ: ${r[1]} phải ${r[2]}`;
  if ((r = /^Too big: expected (\w+) to be ([<>=]+\s?[\d.]+)$/.exec(m))) return `Quá lớn: ${r[1]} phải ${r[2]}`;
  if (m === 'Invalid number' || m === 'Expected number') return 'Số không hợp lệ';
  if (/^Invalid (string|input)/.test(m)) return 'Dữ liệu không hợp lệ';
  return null;
}

/** Translate a location prefix such as "Slide 3 › element 2 (id) › child 1" or "Slide 1 › Image "x"". */
function prefix(p: string): string {
  return p
    .replace(/ › element (\d+)/g, ' › phần tử $1')
    .replace(/ › child (\d+)/g, ' › con $1')
    .replace(/ › ([A-Z][\w-]*(?: [A-Z0-9][\w-]*)*(?:-like)?(?: Visual)?) "/g, (_m, label: string) => ` › ${L(label)} "`);
}

export const MESSAGE_PATTERNS: [RegExp, Tpl][] = [
  /* ------------------------------ validator (rest after prefix) ------------------------------ */
  [/^missing "id"\.$/, 'thiếu "id".'],
  [/^missing "type"\.$/, 'thiếu "type".'],
  [/^missing "content"\.$/, 'thiếu "content".'],
  [/^must be an object\.$/, 'phải là một đối tượng.'],
  [/^duplicate element id "([^"]*)" on the same slide\.$/, 'trùng id phần tử "$1" trên cùng slide.'],
  [/^unknown element type "([^"]*)"\. Auto Fix → "([^"]*)"\.$/, 'loại phần tử "$1" không xác định. Auto Fix → "$2".'],
  [/^unknown element type "([^"]*)"\.$/, 'loại phần tử "$1" không xác định.'],
  [/^"(\w+)" must be a number \(got ([\s\S]*)\)\.$/, '"$1" phải là số (nhận được $2).'],
  [/^unsupported property "([^"]*)" \(ignored\)\.$/, 'thuộc tính "$1" không được hỗ trợ (bỏ qua).'],
  [/^style "([^"]*)" is not supported \(ignored\)\.$/, 'style "$1" không được hỗ trợ (bỏ qua).'],
  [/^style\.(\w+) "([^"]*)" is not a valid color\.$/, 'style.$1 "$2" không phải màu hợp lệ.'],
  [/^opacity must be 0–1\.$/, 'opacity phải trong khoảng 0–1.'],
  [/^text element has no text\.$/, 'phần tử văn bản không có chữ.'],
  [/^element is completely outside the (\d+)×(\d+) canvas\.$/, 'phần tử nằm hoàn toàn ngoài khung $1×$2.'],
  [/^element extends beyond the canvas edge\.$/, 'phần tử tràn ra ngoài mép khung slide.'],
  [/^image needs "src" \(verified URL\) or "query" \(search intent\)\.$/, 'hình ảnh cần "src" (URL đã xác minh) hoặc "query" (từ khóa tìm ảnh).'],
  [/^unsafe or unsupported image URL "([\s\S]*)"\.$/, 'URL ảnh không an toàn hoặc không được hỗ trợ "$1".'],
  [/^unsafe media URL\.$/, 'URL media không an toàn.'],
  [/^unsafe background image URL\.$/, 'URL ảnh nền không an toàn.'],
  [/^image has no alt text\.$/, 'hình ảnh không có văn bản thay thế (alt).'],
  [/^row (\d+) has (\d+) cells \(header has (\d+)\)\.$/, 'hàng $1 có $2 ô (hàng tiêu đề có $3).'],
  [/^edge (\d+) references unknown node "([^"]*)"\.$/, 'cạnh $1 tham chiếu tới nút không tồn tại "$2".'],
  [/^flowchart needs "nodes"\.$/, 'lưu đồ cần "nodes".'],
  [/^"([^"]*)" needs "items"\.$/, '"$1" cần "items".'],
  [/^SWOT expects exactly 4 items\.$/, 'SWOT cần đúng 4 mục.'],
  [/^unknown shape "([^"]*)"\. Use one of: ([\s\S]+)\.$/, 'hình "$1" không xác định. Dùng một trong: $2.'],
  [/^animation should be an array\.$/, 'animation phải là một mảng.'],
  [/^animation "([^"]*)" should be an object \{ effect \}\.$/, 'animation "$1" phải là đối tượng { effect }.'],
  [/^animation (\d+) needs "effect"\.$/, 'animation $1 cần "effect".'],
  [/^unknown animation effect "([^"]*)"\. Auto Fix → "([^"]*)"\.$/, 'hiệu ứng animation "$1" không xác định. Auto Fix → "$2".'],
  [/^unknown animation effect "([^"]*)"\.$/, 'hiệu ứng animation "$1" không xác định.'],
  [/^animation property "([^"]*)" is not supported\.$/, 'thuộc tính animation "$1" không được hỗ trợ.'],
  [/^"([^"]*)" — PowerPoint export: ([\s\S]+)\.$/, (e, note) => `"${e}" — xuất PowerPoint: ${L(note)}.`],
  [/^"onExit" trigger plays in web presentation only\.$/, 'kích hoạt "onExit" chỉ chạy khi trình chiếu trên web.'],
  // chart checks
  [/^unknown chartType "([^"]*)"\. Use: ([\s\S]+)\.$/, 'chartType "$1" không xác định. Dùng: $2.'],
  [/^chart has no series\.$/, 'biểu đồ không có chuỗi dữ liệu.'],
  [/^series "([^"]*)" needs "points" \[\{x,y(,size)?\}\] for (\w+)\.$/, 'chuỗi "$1" cần "points" [{x,y$2}] cho biểu đồ $3.'],
  [/^histogram series needs raw "values"\.$/, 'chuỗi histogram cần "values" thô.'],
  [/^series "([^"]*)" needs "values"\.$/, 'chuỗi "$1" cần "values".'],
  [/^series "([^"]*)" has (\d+) values but there are (\d+) categories\. Data is never padded automatically — please correct it\.$/, 'chuỗi "$1" có $2 giá trị nhưng có $3 nhóm. Dữ liệu không bao giờ được tự bù — hãy sửa lại.'],
  [/^series "([^"]*)" contains non-numeric values\.$/, 'chuỗi "$1" chứa giá trị không phải số.'],
  [/^(\w+) charts cannot show negative values\.$/, 'biểu đồ $1 không thể hiển thị giá trị âm.'],
  [/^"categories" is required\.$/, 'bắt buộc có "categories".'],
  [/^(\w+) shows only the first series\.$/, 'biểu đồ $1 chỉ hiển thị chuỗi đầu tiên.'],
  [/^(\d+) slices is hard to read — consider a bar chart\.$/, '$1 phần rất khó đọc — nên dùng biểu đồ thanh.'],
  [/^a line chart with fewer than 3 points rarely shows a trend\.$/, 'biểu đồ đường có ít hơn 3 điểm hiếm khi thể hiện được xu hướng.'],
  // slide-level (rest after "Slide N: ")
  [/^unsupported property "([^"]*)" \(ignored\)\.$/, 'thuộc tính "$1" không được hỗ trợ (bỏ qua).'],
  [/^unknown layout "([^"]*)" — the best matching layout will be chosen automatically\.$/, 'bố cục "$1" không xác định — hệ thống sẽ tự chọn bố cục phù hợp nhất.'],
  [/^layout "([^"]*)" does not display ([\s\S]+)\. The data is kept; choose another layout to show it\.$/, 'bố cục "$1" không hiển thị $2. Dữ liệu vẫn được giữ; hãy chọn bố cục khác để hiển thị.'],
  [/^background "([^"]*)" is not a valid color\.$/, 'nền "$1" không phải màu hợp lệ.'],
  [/^unknown transition "([^"]*)"\. Did you mean "([^"]*)"\?$/, 'hiệu ứng chuyển slide "$1" không xác định. Ý bạn là "$2"?'],
  [/^unknown transition "([^"]*)"\.$/, 'hiệu ứng chuyển slide "$1" không xác định.'],
  [/^transition "([^"]*)" — PowerPoint export: ([\s\S]+)\.$/, (t, note) => `hiệu ứng chuyển "${t}" — xuất PowerPoint: ${L(note)}.`],
  [/^Morph found no element ids shared with slide (\d+)\. Reuse the same element "id" on both slides to animate it\.$/, 'Morph không tìm thấy id phần tử chung với slide $1. Hãy dùng cùng "id" phần tử trên cả hai slide để tạo chuyển động.'],
  [/^too many elements \((\d+)\)\.$/, 'quá nhiều phần tử ($1).'],
  [/^unknown animationPreset "([^"]*)"\. Use: ([\s\S]+)\.$/, 'animationPreset "$1" không xác định. Dùng: $2.'],
  [/^animations\["([^"]*)"\]\[(\d+)\] has unknown effect "([^"]*)"\.$/, 'animations["$1"][$2] có hiệu ứng không xác định "$3".'],
  /* ------------------------------ Auto Fix (rest after prefix) ------------------------------ */
  [/^added id "([^"]*)"\.$/, 'đã thêm id "$1".'],
  [/^duplicate id "([^"]*)" renamed to "([^"]*)"\.$/, 'id trùng "$1" đã đổi thành "$2".'],
  [/^type "([^"]*)" → "([^"]*)"\.$/, 'loại "$1" → "$2".'],
  [/^(\w+) "([^"]*)" → ([\s\S]+)\.$/, (k, a, b) => `đã đổi ${({ shape: 'hình', chartType: 'chartType', transition: 'hiệu ứng chuyển', animation: 'animation', trigger: 'kích hoạt' } as Record<string, string>)[k] ?? k} "${a}" → ${b}.`],
  [/^"w" renamed to "width"\.$/, 'đã đổi "w" thành "width".'],
  [/^"h" renamed to "height"\.$/, 'đã đổi "h" thành "height".'],
  [/^opacity percent converted to 0–1\.$/, 'đã chuyển opacity dạng phần trăm sang 0–1.'],
  [/^string content wrapped as \{ text \}\.$/, 'đã bọc nội dung chuỗi thành { text }.'],
  [/^"text" moved into content\.$/, 'đã chuyển "text" vào content.'],
  [/^image src moved into content\.$/, 'đã chuyển src của ảnh vào content.'],
  [/^content\.url renamed to src\.$/, 'đã đổi content.url thành src.'],
  [/^blocked unsafe image URL "([\s\S]*)" \(kept as search query\)\.$/, 'đã chặn URL ảnh không an toàn "$1" (giữ lại làm từ khóa tìm ảnh).'],
  [/^chart "type" renamed to "chartType"\.$/, 'đã đổi "type" của biểu đồ thành "chartType".'],
  [/^chart "labels" renamed to "categories"\.$/, 'đã đổi "labels" của biểu đồ thành "categories".'],
  [/^Chart\.js "datasets" converted to "series" \(values unchanged\)\.$/, 'đã chuyển "datasets" kiểu Chart.js thành "series" (giữ nguyên giá trị).'],
  [/^series "data" renamed to "values"\.$/, 'đã đổi "data" của chuỗi thành "values".'],
  [/^animation wrapped in an array\.$/, 'đã bọc animation vào một mảng.'],
  [/^animation "type" renamed to "effect"\.$/, 'đã đổi "type" của animation thành "effect".'],
  [/^animation (duration|delay) "([^"]*)" → (\d+)ms\.$/, (k, a, b) => `${k === 'duration' ? 'thời lượng' : 'độ trễ'} animation "${a}" → ${b}ms.`],
  [/^animation duration in seconds converted to ms\.$/, 'đã đổi thời lượng animation từ giây sang ms.'],
  [/^transition duration normalized\.$/, 'đã chuẩn hóa thời lượng hiệu ứng chuyển slide.'],
  /* ------------------------------ export (rest after "Slide N › X "id": ") ------------------------------ */
  [/^image unavailable \(search intent “([\s\S]*)”\) — exported as an editable placeholder shape\. Replace it in PowerPoint or resolve it in the editor before exporting\.$/, 'không có ảnh (từ khóa tìm ảnh “$1”) — đã xuất thành hình giữ chỗ chỉnh sửa được. Hãy thay ảnh trong PowerPoint hoặc chọn ảnh trong trình biên tập trước khi xuất.'],
  [/^image unavailable \(URL could not be downloaded\) — exported as an editable placeholder shape\. Replace it in PowerPoint or resolve it in the editor before exporting\.$/, 'không có ảnh (không tải được URL) — đã xuất thành hình giữ chỗ chỉnh sửa được. Hãy thay ảnh trong PowerPoint hoặc chọn ảnh trong trình biên tập trước khi xuất.'],
  [/^image unavailable([\s\S]*)$/, 'không có ảnh$1'],
  [/^(video|audio) could not be embedded — exported as a linked placeholder\.$/, (k) => `không nhúng được ${k === 'video' ? 'video' : 'âm thanh'} — đã xuất thành ô giữ chỗ có liên kết.`],
  [/^formula exported as LaTeX source text \(renderer unavailable in this environment\)\.$/, 'công thức được xuất dưới dạng mã LaTeX (môi trường này không có trình hiển thị).'],
  [/^element opacity on text is approximated with text transparency\.$/, 'độ mờ của phần tử chữ được mô phỏng bằng độ trong suốt của chữ.'],
  [/^"([^"]*)" could not be grouped; its shapes are exported ungrouped\.$/, '"$1" không nhóm được; các hình được xuất rời.'],
  [/^(\w+) has no native PowerPoint chart type — exported as editable shapes\.$/, (k) => `${L(k)} không có loại biểu đồ gốc trong PowerPoint — đã xuất thành hình khối chỉnh sửa được.`],
  [/^Morph has no matching objects with slide (\d+); PowerPoint will perform a plain fade\.$/, 'Morph không có đối tượng khớp với slide $1; PowerPoint sẽ chỉ chuyển mờ dần.'],
  [/^Morph matches (\d+) object\(s\) by "!!" names \(PowerPoint 2019 \/ Microsoft 365; older versions fall back to Fade\)\.$/, 'Morph ghép $1 đối tượng theo tên "!!" (PowerPoint 2019 / Microsoft 365; bản cũ hơn sẽ dùng Mờ dần).'],
  [/^(\d+) "onExit" animation\(s\) play in the web presentation only\.$/, '$1 animation "onExit" chỉ chạy khi trình chiếu trên web.'],
  [/^background image has no resolved file — exported as a solid color\.$/, 'ảnh nền chưa có tệp — đã xuất thành màu đặc.'],
  [/^background image unavailable — solid color used\.$/, 'không có ảnh nền — dùng màu đặc.'],
  [/^image "([\s\S]*)" has no resolved file — it will be exported as a placeholder\.$/, 'ảnh "$1" chưa có tệp — sẽ được xuất thành ô giữ chỗ.'],
  [/^text in "([^"]*)" may overflow its box \(~(\d+)px needed, (\d+)px available\)\.$/, 'chữ trong "$1" có thể tràn hộp (cần ~$2px, chỉ có $3px).'],
  /* ------------------------------ messages without prefix ------------------------------ */
  [/^JSON syntax error: ([\s\S]+)$/, 'Lỗi cú pháp JSON: $1'],
  [/^Removed markdown code fences \((\d+) blocks found\)\.$/, 'Đã gỡ rào mã markdown ($1 khối được tìm thấy).'],
  [/^Merged (\d+) parts into one presentation\.$/, 'Đã ghép $1 phần thành một bài thuyết trình.'],
  [/^This is part (\d+) of (\d+) for presentation "([^"]*)"\.$/, 'Đây là phần $1/$2 của bài thuyết trình "$3".'],
  [/^Missing "schemaVersion" \(expected "([^"]*)"\)\.$/, 'Thiếu "schemaVersion" (cần "$1").'],
  [/^schemaVersion "([^"]*)" differs from supported "([^"]*)"\.$/, 'schemaVersion "$1" khác phiên bản được hỗ trợ "$2".'],
  [/^Set schemaVersion to "([^"]*)" \(was ([\s\S]*)\)\.$/, 'Đã đặt schemaVersion thành "$1" (trước đó là $2).'],
  [/^Unsupported presentation property "([^"]*)" \(kept in metadata, not rendered\)\.$/, 'Thuộc tính presentation "$1" không được hỗ trợ (giữ trong metadata, không hiển thị).'],
  [/^Unknown theme "([^"]*)" — the default theme will be used\. Available: ([\s\S]+)\.$/, 'Theme "$1" không xác định — sẽ dùng theme mặc định. Các theme có sẵn: $2.'],
  [/^Unsupported aspectRatio "([^"]*)"\.$/, 'aspectRatio "$1" không được hỗ trợ.'],
  [/^aspectRatio "custom" requires "size": \{ width, height \}\.$/, 'aspectRatio "custom" cần "size": { width, height }.'],
  [/^Too many slides \((\d+) > (\d+)\)\. Split into parts\.$/, 'Quá nhiều slide ($1 > $2). Hãy chia thành nhiều phần.'],
  [/^Source is too large \(([\d.]+) MB > 8 MB\)\.$/, 'Mã nguồn quá lớn ($1 MB > 8 MB).'],
  [/^Slide (\d+) has no id\.$/, 'Slide $1 không có id.'],
  [/^Slide (\d+) has no elements and no content\.$/, 'Slide $1 không có phần tử và không có nội dung.'],
  [/^Slide (\d+) must be an object\.$/, 'Slide $1 phải là một đối tượng.'],
  [/^Duplicate slide id "([^"]*)" \(also slide (\d+)\)\.$/, 'Trùng id slide "$1" (cũng có ở slide $2).'],
  [/^Section (\d+) has no recognizable content\.$/, 'Phần $1 không có nội dung nhận diện được.'],
  [/^Unknown identifier "([^"]*)" treated as undefined\.$/, 'Định danh "$1" không xác định, coi như undefined.'],
  [/^Unknown component <([^>]*)> — converted to a text box so no content is lost\.$/, 'Component <$1> không xác định — đã chuyển thành hộp văn bản để không mất nội dung.'],
  [/^Loose text in <Slide> wrapped in a <Text> element: "([\s\S]*)"$/, 'Chữ rời trong <Slide> đã được bọc vào phần tử <Text>: "$1"'],
  [/^<([^>]*)> must be inside a <Slide>\.$/, '<$1> phải nằm trong một <Slide>.'],
  [/^<([^>]*)> is not allowed here\.$/, '<$1> không được phép ở đây.'],
  [/^Unsupported syntax "([^"]*)" — only static data, constants, templates and \.map\(\) are allowed\.$/, 'Cú pháp "$1" không được hỗ trợ — chỉ cho phép dữ liệu tĩnh, hằng số, template và .map().'],
  [/^Unsupported operator "([^"]*)"\.$/, 'Toán tử "$1" không được hỗ trợ.'],
  [/^Unsupported statement "([^"]*)" inside function\.$/, 'Câu lệnh "$1" trong hàm không được hỗ trợ.'],
  [/^Circular reference to "([^"]*)"\.$/, 'Tham chiếu vòng tới "$1".'],
  // export preflight / report
  [/^Fonts not bundled with Office: ([\s\S]+)\. Install them \(free on Google Fonts\) on the presenting computer, or PowerPoint will substitute a fallback font and line breaks may change\.$/, 'Phông chữ không có sẵn trong Office: $1. Hãy cài đặt (miễn phí trên Google Fonts) trên máy trình chiếu, nếu không PowerPoint sẽ thay bằng phông khác và cách xuống dòng có thể thay đổi.'],
  [/^Animation trigger "onExit" \(web presentation only\)$/, 'Kích hoạt animation "onExit" (chỉ khi trình chiếu web)'],
  [/^Animation ([^—]+?) — ([\s\S]+)$/, (a, note) => `Animation ${L(a)} — ${L(note)}`],
  [/^Animation ([\s\S]+)$/, (a) => (REGISTRY[a] ? `Animation ${L(a)}` : '\u0000')],
  [/^Transition ([^—]+?) — ([\s\S]+)$/, (a, note) => `Hiệu ứng chuyển ${L(a)} — ${L(note)}`],
  [/^Chart \(([\s\S]+)\) → native chart$/, (c) => `Biểu đồ (${L(c)}) → biểu đồ gốc`],
  [/^Chart \(([\s\S]+)\) → editable native shapes \(no native PowerPoint chart type\)$/, (c) => `Biểu đồ (${L(c)}) → hình khối gốc chỉnh sửa được (PowerPoint không có loại biểu đồ này)`],
  [/^Cube → PowerPoint "Prism \(content\)" transition(; Transition sounds are not exported)?$/, (s) => `Khối lập phương → hiệu ứng "Prism (content)" của PowerPoint${s ? '; Âm thanh chuyển slide không được xuất' : ''}`],
  [/^Post-export: ([\s\S]+)$/, (c) => `Sau khi xuất: ${translateMessage(c)}`],
  [/^ZIP container opens$/, 'Mở được tệp ZIP'],
  [/^\[Content_Types\]\.xml present$/, 'Có [Content_Types].xml'],
  [/^ppt\/presentation\.xml present$/, 'Có ppt/presentation.xml'],
  [/^presentation\.xml slide list$/, 'Danh sách slide trong presentation.xml'],
  [/^Slide count$/, 'Số lượng slide'],
  [/^All XML parts well-formed$/, 'Mọi phần XML đều hợp lệ'],
  [/^All relationship targets \/ embedded media present$/, 'Đủ mọi đích liên kết / media nhúng'],
  [/^Slide element order \(cSld → clrMapOvr → transition → timing\)$/, 'Thứ tự phần tử slide (cSld → clrMapOvr → transition → timing)'],
  [/^Speaker notes present$/, 'Có ghi chú người trình bày'],
  [/^Animation targets exist$/, 'Đối tượng của animation tồn tại'],
  [/^Unique shape ids$/, 'Id hình là duy nhất'],
  [/^(\d+) supported, (\d+) partial, (\d+) unsupported mappings$/, '$1 hỗ trợ đầy đủ, $2 một phần, $3 không hỗ trợ'],
  [/^(\d+) unresolved$/, '$1 chưa có ảnh'],
  [/^(\d+) box\(es\) may overflow$/, '$1 hộp chữ có thể bị tràn'],
  [/^(\d+) slides$/, '$1 slide'],
  [/^(\d+) parts$/, '$1 phần'],
  [/^(\d+) sldId entries$/, '$1 mục sldId'],
  [/^(\d+) element\(s\) outside$/, '$1 phần tử nằm ngoài'],
  [/^([\s\S]+): ([\s\S]+)$/, (label, note) => (REGISTRY[label] && REGISTRY[note] ? `${L(label)}: ${L(note)}` : `\u0000`)],
  // quality checker
  [/^Heading has (\d+) words\.$/, 'Tiêu đề có $1 từ.'],
  [/^(\d+) bullet points\.$/, '$1 gạch đầu dòng.'],
  [/^(\d+) distinct colors\.$/, '$1 màu khác nhau.'],
  [/^(\d+) font families across the deck\.$/, '$1 họ phông chữ trong cả bài.'],
  [/^(\d+) font families on one slide \(([\s\S]*)\)\.$/, '$1 họ phông chữ trên một slide ($2).'],
  [/^(\d+) words on one slide\.$/, '$1 từ trên một slide.'],
  [/^Text "([\s\S]*)" is (\d+)px \(at 1080p\)\.$/, 'Chữ "$1" chỉ $2px (ở 1080p).'],
  [/^Text boxes "([^"]*)" and "([^"]*)" overlap\.$/, 'Hộp chữ "$1" và "$2" chồng lên nhau.'],
  [/^Low contrast ([\d.]+):1 for "([\s\S]*)" \(needs ([\d.]+):1\)\.$/, 'Tương phản thấp $1:1 cho "$2" (cần $3:1).'],
  [/^Image “([\s\S]*)” is only a search intent \(not chosen yet\)\.$/, 'Ảnh “$1” mới chỉ là từ khóa tìm ảnh (chưa chọn ảnh).'],
  // layout assistant
  [/^([\s\S]+) \(fit (\d+)\/100\)$/, (d, n) => `${L(d)} (phù hợp ${n}/100)`],
  [/^([\s\S]+) with image$/, (l) => `${L(l)} kèm ảnh`],
  [/^Shows the (\d+) points as a (\w+) diagram\.$/, (n, k) => `Hiển thị ${n} ý thành sơ đồ ${kindVi(k)}.`],
  [/^(\w+) diagram$/, (k) => `Sơ đồ ${kindVi(k)}`],
  [/^Keeps (\d+) points on the slide; (\d+) move to speaker notes\.$/, 'Giữ $1 ý trên slide; $2 ý chuyển sang ghi chú người trình bày.'],
  [/^(\d+) words on this slide — no reduction needed\.$/, 'Slide này có $1 từ — không cần rút gọn.'],
  [/^Fix (\d+) low-contrast text$/, 'Sửa $1 chữ có độ tương phản thấp'],
];

function kindVi(k: string): string {
  return ({ cycle: 'chu trình', list: 'danh sách', process: 'quy trình', pyramid: 'kim tự tháp', Process: 'quy trình', Cycle: 'chu trình', List: 'danh sách', Pyramid: 'kim tự tháp' } as Record<string, string>)[k] ?? k;
}

export function translateMessage(s: string): string {
  if (STATIC[s]) return STATIC[s];
  if (REGISTRY[s]) return REGISTRY[s];
  // location prefix: "Slide 3 › element 2 (id) › child 1: rest" / "Slide 1: rest" / "Slide 1 › Image "x": rest" / "Slide 1 › slides[0].x: zod"
  const pre = /^(Slide \d+(?: › [\s\S]+?)?): ([\s\S]+)$/.exec(s);
  if (pre && !/^Slide \d+ (has|must)/.test(s)) {
    const rest = pre[2];
    const zr = zodMsg(rest);
    const tr = zr ?? translateMessage(rest);
    if (tr !== rest) return `${prefix(pre[1])}: ${tr}`;
  }
  // root-level zod: "title: Invalid input…"
  const root = /^([\w.[\]]+): ([\s\S]+)$/.exec(s);
  if (root) {
    const zr = zodMsg(root[2]);
    if (zr) return `${root[1]}: ${zr}`;
  }
  for (const [re, tpl] of MESSAGE_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    const out = typeof tpl === 'string' ? s.replace(re, tpl) : (tpl as (...g: string[]) => string)(...m.slice(1).map((g) => g ?? ''));
    if (out === '\u0000') continue; // pattern declined
    return out;
  }
  return s;
}
