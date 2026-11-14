Dưới đây là bài thuyết trình hoàn chỉnh (13 slide, giao diện Modern Corporate). Hãy dán toàn bộ khối JSON vào Code Import của SlideCraft AI Studio.

```json
{
  "schemaVersion": "1.0",
  "id": "hat-nau-chuyen-doi-so",
  "title": "Chuyển đổi số cho chuỗi cà phê Hạt Nâu",
  "description": "Báo cáo đề xuất chuyển đổi số cho 12 cửa hàng Hạt Nâu tại Hà Nội và Đà Nẵng, trình Ban Giám đốc.",
  "author": "Nguyễn Minh An",
  "language": "vi",
  "aspectRatio": "16:9",
  "theme": "modern-corporate",
  "globalStyles": { "slideNumbers": true, "footer": "Hạt Nâu · Đề xuất chuyển đổi số" },
  "slides": [
    {
      "id": "s1-title",
      "layout": "title",
      "content": {
        "eyebrow": "Báo cáo đề xuất · Trình Ban Giám đốc",
        "heading": "Chuyển đổi số cho chuỗi cà phê Hạt Nâu",
        "subheading": "12 cửa hàng tại Hà Nội và Đà Nẵng",
        "body": "Nguyễn Minh An, Trưởng phòng Vận hành"
      },
      "transition": { "type": "fade", "duration": 700 },
      "notes": "Xin chào Ban Giám đốc. Hôm nay tôi trình bày đề xuất chuyển đổi số cho toàn bộ 12 cửa hàng Hạt Nâu tại Hà Nội và Đà Nẵng, gồm vấn đề hiện tại, giải pháp, lộ trình, ngân sách và mục tiêu sau 12 tháng."
    },
    {
      "id": "s2-revenue",
      "layout": "dataStory",
      "content": {
        "eyebrow": "Bối cảnh",
        "heading": "Doanh thu tăng đều qua ba năm",
        "chart": {
          "chartType": "column",
          "categories": ["2023", "2024", "2025 (ước)"],
          "series": [{ "name": "Doanh thu", "values": [38, 44, 49] }],
          "valueSuffix": " tỷ",
          "showLabels": true,
          "showLegend": false,
          "yAxisTitle": "Tỷ đồng",
          "source": "Số liệu nội bộ Hạt Nâu; 2025 là số ước tính"
        },
        "stats": [{ "value": "49 tỷ", "label": "doanh thu 2025 (ước tính)" }],
        "body": "Từ 38 tỷ đồng năm 2023 lên 44 tỷ năm 2024. Tăng trưởng đang đến, nhưng nền tảng vận hành chưa theo kịp."
      },
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Doanh thu năm 2023 là 38 tỷ đồng, năm 2024 là 44 tỷ và năm 2025 ước tính 49 tỷ. Chuỗi đang tăng trưởng tốt, vì vậy đây là thời điểm phù hợp để đầu tư nền tảng số trước khi quy mô lớn hơn làm lộ rõ các điểm nghẽn."
    },
    {
      "id": "s3-channels",
      "layout": "chartFocus",
      "content": {
        "eyebrow": "Kênh bán 2025",
        "heading": "Kênh tại quầy chiếm 62% tỷ trọng bán hàng",
        "chart": {
          "chartType": "donut",
          "categories": ["Tại quầy", "Giao hàng qua app đối tác", "Đặt trước qua Zalo"],
          "series": [{ "name": "Tỷ trọng kênh bán 2025", "values": [62, 28, 10] }],
          "valueSuffix": "%",
          "showLabels": true,
          "showLegend": true,
          "centerLabel": "2025",
          "source": "Số liệu nội bộ Hạt Nâu"
        },
        "caption": "Giao hàng qua app đối tác 28% và đặt trước qua Zalo 10%: hai kênh này chưa nằm trong một hệ thống dữ liệu chung."
      },
      "transition": { "type": "fade", "duration": 600 },
      "notes": "Năm 2025, tại quầy chiếm 62%, giao hàng qua app đối tác 28% và đặt trước qua Zalo 10%. Phần lớn khách vẫn xếp hàng tại quầy, nên trải nghiệm giờ cao điểm quyết định rất nhiều đến doanh thu."
    },
    {
      "id": "s4-problems",
      "layout": "cardGrid",
      "content": {
        "eyebrow": "Vấn đề",
        "heading": "Bốn điểm nghẽn đang kìm hãm tăng trưởng",
        "items": [
          { "title": "Chờ lâu giờ cao điểm", "text": "Thời gian chờ trung bình 11 phút.", "icon": "clock" },
          { "title": "Khách bỏ về", "text": "30% khách bỏ về khi xếp hàng quá 3 người.", "icon": "users" },
          { "title": "Dữ liệu rải rác", "text": "Dữ liệu khách hàng nằm trên 3 hệ thống khác nhau.", "icon": "database" },
          { "title": "Chưa giữ chân khách", "text": "Chưa có chương trình khách hàng thân thiết.", "icon": "heart-handshake" }
        ]
      },
      "transition": { "type": "wipe", "direction": "left", "duration": 600 },
      "notes": "Có bốn vấn đề chính. Thứ nhất, thời gian chờ trung bình giờ cao điểm là 11 phút. Thứ hai, 30% khách bỏ về khi hàng quá 3 người. Thứ ba, dữ liệu khách hàng nằm rải rác trên 3 hệ thống. Thứ tư, chúng ta chưa có chương trình khách hàng thân thiết để giữ chân khách."
    },
    {
      "id": "s5-bignumber",
      "layout": "bigNumber",
      "content": {
        "eyebrow": "Doanh thu đang rơi mất",
        "stats": [{ "value": "30%", "label": "khách bỏ về khi xếp hàng quá 3 người" }],
        "body": "Thời gian chờ trung bình giờ cao điểm là 11 phút."
      },
      "transition": { "type": "zoom", "duration": 600 },
      "notes": "Hãy dừng lại ở con số này: cứ 10 khách thì có 3 người bỏ về khi hàng quá 3 người. Với thời gian chờ trung bình 11 phút giờ cao điểm, đây là điểm đau lớn nhất mà đề xuất này cần giải quyết trước tiên."
    },
    {
      "id": "s6-solution",
      "layout": "infographic",
      "content": {
        "eyebrow": "Giải pháp đề xuất",
        "heading": "Bốn cấu phần của chuyển đổi số",
        "diagram": {
          "kind": "hub",
          "center": "Hạt Nâu số",
          "items": [
            { "title": "App đặt món và tích điểm", "text": "Ứng dụng riêng của Hạt Nâu", "icon": "smartphone" },
            { "title": "POS hợp nhất trên cloud", "text": "Một hệ thống cho mọi cửa hàng", "icon": "cloud-cog" },
            { "title": "Kho dữ liệu + dashboard", "text": "Dữ liệu khách hàng tập trung", "icon": "database" },
            { "title": "Đào tạo nhân viên", "text": "Làm chủ hệ thống mới", "icon": "graduation-cap" }
          ]
        }
      },
      "transition": { "type": "fade", "duration": 600 },
      "notes": "Giải pháp gồm bốn cấu phần: một, app đặt món và tích điểm riêng; hai, hệ thống POS hợp nhất trên cloud; ba, kho dữ liệu khách hàng cùng dashboard; bốn, đào tạo nhân viên. Bốn phần này bổ trợ nhau và cùng xoay quanh trải nghiệm của khách."
    },
    {
      "id": "s7-mapping",
      "layout": "tableFocus",
      "content": {
        "eyebrow": "Giải pháp và vấn đề",
        "heading": "Mỗi cấu phần giải quyết một điểm nghẽn",
        "table": {
          "rows": [
            ["Vấn đề hiện tại", "Cấu phần giải quyết"],
            ["Chờ 11 phút giờ cao điểm; 30% khách bỏ về", "App đặt món và POS hợp nhất trên cloud"],
            ["Dữ liệu khách hàng nằm trên 3 hệ thống", "Kho dữ liệu khách hàng + dashboard"],
            ["Chưa có chương trình khách hàng thân thiết", "App đặt món và tích điểm riêng"],
            ["Nhân viên cần làm quen quy trình mới", "Đào tạo nhân viên"]
          ],
          "header": true,
          "firstColumn": true,
          "columnWidths": [1, 1]
        },
        "body": "Cả bốn vấn đề đều có cấu phần xử lý rõ ràng."
      },
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Bảng này nối từng vấn đề với cấu phần giải quyết. Đặt món trước trên app và POS hợp nhất rút ngắn thời gian chờ; kho dữ liệu gom 3 hệ thống về một nơi; app tích điểm tạo chương trình thân thiết; đào tạo giúp nhân viên vận hành thành thạo."
    },
    {
      "id": "s8-roadmap",
      "layout": "timeline",
      "content": {
        "eyebrow": "Lộ trình 2026",
        "heading": "Bốn quý để hoàn tất chuyển đổi",
        "timeline": {
          "orientation": "horizontal",
          "style": "milestones",
          "items": [
            { "date": "Q1/2026", "title": "Khảo sát và chọn đối tác", "icon": "search" },
            { "date": "Q2/2026", "title": "Triển khai POS", "text": "Cho 12 cửa hàng", "icon": "cloud-cog" },
            { "date": "Q3/2026", "title": "Ra mắt app và chương trình thành viên", "icon": "smartphone" },
            { "date": "Q4/2026", "title": "Dashboard và tối ưu", "icon": "layout-dashboard", "highlight": true }
          ]
        }
      },
      "transition": { "type": "wipe", "direction": "left", "duration": 700 },
      "notes": "Quý 1 khảo sát và chọn đối tác. Quý 2 triển khai POS cho cả 12 cửa hàng. Quý 3 ra mắt app và chương trình thành viên. Quý 4 hoàn thiện dashboard và tối ưu vận hành."
    },
    {
      "id": "s9-budget",
      "layout": "dataStory",
      "content": {
        "eyebrow": "Ngân sách",
        "heading": "Tổng đầu tư 3,2 tỷ đồng, app chiếm phần lớn nhất",
        "chart": {
          "chartType": "donut",
          "categories": ["App đặt món và tích điểm", "POS hợp nhất", "Kho dữ liệu + dashboard", "Đào tạo"],
          "series": [{ "name": "Ngân sách", "values": [1.4, 0.9, 0.6, 0.3] }],
          "valueSuffix": " tỷ",
          "decimals": 1,
          "showLabels": true,
          "showLegend": true,
          "centerLabel": "3,2 tỷ",
          "source": "Dự toán đề xuất của Phòng Vận hành"
        },
        "stats": [{ "value": "3,2 tỷ", "label": "tổng ngân sách đề xuất" }],
        "body": "App 1,4 tỷ; POS 0,9 tỷ; dữ liệu 0,6 tỷ; đào tạo 0,3 tỷ. Dự phòng 10% ngân sách để kiểm soát chi phí vượt."
      },
      "transition": { "type": "fade", "duration": 600 },
      "notes": "Tổng ngân sách là 3,2 tỷ đồng, gồm app 1,4 tỷ, POS 0,9 tỷ, kho dữ liệu và dashboard 0,6 tỷ, đào tạo 0,3 tỷ. Chúng tôi đề xuất dự phòng 10% ngân sách như một biện pháp giảm rủi ro vượt chi phí."
    },
    {
      "id": "s10-goals",
      "layout": "statistics",
      "content": {
        "eyebrow": "Mục tiêu sau 12 tháng",
        "heading": "Kết quả kỳ vọng",
        "stats": [
          { "value": "5 phút", "label": "thời gian chờ", "text": "Giảm từ 11 phút giờ cao điểm" },
          { "value": "40.000", "label": "thành viên", "text": "Qua chương trình khách hàng thân thiết" },
          { "value": "+12%", "label": "doanh thu", "text": "Tăng sau 12 tháng" },
          { "value": "50%", "label": "khách quay lại", "text": "Tăng từ 35%", "trend": "up" }
        ]
      },
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Sau 12 tháng, chúng tôi đặt bốn mục tiêu: giảm thời gian chờ còn 5 phút, đạt 40.000 thành viên, tăng doanh thu 12% và nâng tỷ lệ khách quay lại từ 35% lên 50%."
    },
    {
      "id": "s11-risks",
      "layout": "threeColumns",
      "content": {
        "eyebrow": "Rủi ro và biện pháp",
        "heading": "Ba rủi ro chính đã có hướng xử lý",
        "items": [
          { "title": "Nhân viên chậm thích nghi", "text": "Biện pháp: đào tạo theo đợt.", "icon": "users" },
          { "title": "Chi phí vượt ngân sách", "text": "Biện pháp: dự phòng 10% ngân sách.", "icon": "piggy-bank" },
          { "title": "Tích hợp với app giao hàng", "text": "Biện pháp: chọn đối tác có API mở.", "icon": "plug" }
        ]
      },
      "transition": { "type": "wipe", "direction": "left", "duration": 600 },
      "notes": "Ba rủi ro chính: nhân viên chậm thích nghi, chi phí vượt ngân sách và khó tích hợp với app giao hàng. Biện pháp tương ứng là đào tạo theo đợt, dự phòng 10% ngân sách và ưu tiên đối tác có API mở khi chọn ở quý 1."
    },
    {
      "id": "s12-summary",
      "layout": "minimalType",
      "content": {
        "eyebrow": "Tóm lại",
        "heading": "Từ 11 phút xuống 5 phút, từ 35% lên 50% khách quay lại.",
        "subheading": "Một nền tảng số thống nhất cho cả 12 cửa hàng."
      },
      "transition": { "type": "fade", "duration": 700 },
      "notes": "Tóm tắt thông điệp: đầu tư 3,2 tỷ đồng để giảm thời gian chờ từ 11 xuống 5 phút và nâng tỷ lệ khách quay lại từ 35% lên 50% trên nền tảng thống nhất cho cả chuỗi."
    },
    {
      "id": "s13-close",
      "layout": "closing",
      "content": {
        "eyebrow": "Đề nghị",
        "heading": "Đề nghị Ban Giám đốc phê duyệt ngân sách 3,2 tỷ đồng",
        "body": "Để bắt đầu khảo sát và chọn đối tác trong Q1/2026.",
        "cta": "Phê duyệt triển khai",
        "footer": "Nguyễn Minh An, Trưởng phòng Vận hành"
      },
      "transition": { "type": "fade", "duration": 700 },
      "notes": "Kết thúc bằng đề nghị cụ thể: phê duyệt ngân sách 3,2 tỷ đồng để bắt đầu giai đoạn khảo sát và chọn đối tác trong Q1/2026. Tôi sẵn sàng trả lời câu hỏi của Ban Giám đốc."
    }
  ]
}
```
