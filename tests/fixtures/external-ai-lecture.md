Dưới đây là bài giảng 12 slide, dùng theme Education Modern, giữ nguyên toàn bộ số liệu của giảng viên. Hãy dán toàn bộ khối JSON vào Code Import của SlideCraft AI Studio.

```json
{
  "schemaVersion": "1.0",
  "id": "nang-luong-tai-tao-viet-nam",
  "title": "Năng lượng tái tạo ở Việt Nam",
  "description": "Bài giảng môn Địa lý kinh tế: các nguồn năng lượng tái tạo, xu hướng, thách thức và chính sách.",
  "author": "TS. Lê Thu Hà",
  "language": "vi",
  "aspectRatio": "16:9",
  "theme": "education-modern",
  "globalStyles": { "slideNumbers": true, "footer": "Năng lượng tái tạo ở Việt Nam · Địa lý kinh tế" },
  "slides": [
    {
      "id": "s1-title",
      "layout": "hero",
      "content": {
        "eyebrow": "Địa lý kinh tế · Đại học năm 2",
        "heading": "Năng lượng tái tạo ở Việt Nam",
        "subheading": "Nguồn lực, xu hướng phát triển, thách thức và chính sách",
        "body": "Giảng viên: TS. Lê Thu Hà",
        "image": {
          "query": "aerial view of large solar farm with wind turbines on the Vietnamese coast at sunset",
          "alt": "Cánh đồng điện mặt trời và các tua-bin gió ven biển lúc hoàng hôn"
        }
      },
      "animationPreset": "education",
      "transition": { "type": "fade", "duration": 700 },
      "notes": "Chào lớp và giới thiệu chủ đề: năng lượng tái tạo là một chủ đề trọng tâm của địa lý kinh tế vì mỗi nguồn gắn chặt với điều kiện tự nhiên của từng vùng. Nói rõ buổi học sẽ đi từ nguồn lực, đến số liệu, thách thức rồi chính sách, và kết thúc bằng một câu hỏi thảo luận."
    },
    {
      "id": "s2-objectives",
      "layout": "singleColumn",
      "content": {
        "eyebrow": "Mục tiêu bài học",
        "heading": "Sau buổi học, bạn cần hiểu được",
        "bullets": [
          "Các nguồn năng lượng tái tạo chính ở Việt Nam",
          "Xu hướng phát triển của điện mặt trời và điện gió",
          "Những thách thức đối với hệ thống điện",
          "Chính sách hỗ trợ: giá FIT và Quy hoạch điện VIII"
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Đọc nhanh bốn mục tiêu và nhấn mạnh rằng sinh viên sẽ phải dùng cả bốn ý này để trả lời câu hỏi thảo luận cuối buổi. Khuyến khích sinh viên ghi chú theo từng mục tiêu."
    },
    {
      "id": "s3-agenda",
      "layout": "agenda",
      "content": {
        "eyebrow": "Nội dung buổi học",
        "heading": "Lộ trình bài giảng",
        "items": [
          { "title": "Các nguồn năng lượng tái tạo", "text": "Mặt trời, gió, thủy điện nhỏ, sinh khối" },
          { "title": "Xu hướng phát triển", "text": "Công suất lắp đặt 2019–2022 và công thức minh họa" },
          { "title": "Thách thức", "text": "Lưới điện, tính ổn định, lưu trữ, khung giá" },
          { "title": "Chính sách", "text": "Cơ chế giá FIT và Quy hoạch điện VIII" },
          { "title": "Thảo luận", "text": "Điện gió ngoài khơi hay điện mặt trời áp mái?" }
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "fade", "duration": 500 },
      "notes": "Giới thiệu thứ tự năm phần. Phần thảo luận cuối buổi là phần sinh viên chủ động phát biểu, nên hãy nhắc các em chuẩn bị lập luận ngay từ đầu."
    },
    {
      "id": "s4-sources",
      "layout": "cardGrid",
      "content": {
        "eyebrow": "Phân bố theo không gian",
        "heading": "Bốn nguồn năng lượng tái tạo chính",
        "subheading": "Mỗi nguồn gắn với một vùng có điều kiện tự nhiên phù hợp",
        "items": [
          { "title": "Mặt trời", "text": "Ninh Thuận, Bình Thuận", "icon": "sun" },
          { "title": "Gió", "text": "Ven biển Nam Trung Bộ, Tây Nam Bộ", "icon": "wind" },
          { "title": "Thủy điện nhỏ", "text": "Miền núi phía Bắc", "icon": "droplet" },
          { "title": "Sinh khối", "text": "Đồng bằng sông Cửu Long", "icon": "leaf" }
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "wipe", "direction": "left", "duration": 600 },
      "notes": "Đây là phần địa lý rõ nhất của bài: yêu cầu sinh viên chỉ vị trí từng vùng trên bản đồ. Hỏi lớp vì sao điện mặt trời tập trung ở Ninh Thuận và Bình Thuận, vì sao thủy điện nhỏ gắn với miền núi phía Bắc và sinh khối gắn với Đồng bằng sông Cửu Long."
    },
    {
      "id": "s5-capacity-chart",
      "layout": "chartFocus",
      "content": {
        "eyebrow": "Xu hướng phát triển",
        "heading": "Công suất lắp đặt điện mặt trời và điện gió, 2019–2022",
        "chart": {
          "chartType": "column",
          "categories": ["2019", "2020", "2021", "2022"],
          "series": [
            { "name": "Điện mặt trời", "values": [5.5, 16.5, 16.6, 16.7] },
            { "name": "Điện gió", "values": [0.4, 0.6, 4.0, 4.1] }
          ],
          "valueSuffix": " GW",
          "decimals": 1,
          "showLegend": true,
          "showLabels": true,
          "yAxisTitle": "Công suất lắp đặt (GW)",
          "source": "Số liệu do giảng viên cung cấp"
        },
        "caption": "Công suất lắp đặt, đơn vị GW. Nguồn: số liệu do giảng viên cung cấp."
      },
      "animationPreset": "data",
      "transition": { "type": "fade", "duration": 600 },
      "notes": "Cho sinh viên quan sát biểu đồ trước khi giải thích. Điện mặt trời tăng từ 5,5 GW năm 2019 lên 16,5 GW năm 2020 rồi gần như đi ngang ở 16,6 và 16,7 GW. Điện gió từ 0,4 và 0,6 GW lên 4,0 GW năm 2021 và 4,1 GW năm 2022. Đặt câu hỏi: vì sao hai nguồn tăng ở hai thời điểm khác nhau?"
    },
    {
      "id": "s6-key-figures",
      "layout": "statistics",
      "content": {
        "eyebrow": "Điểm nhấn từ số liệu",
        "heading": "Hai bước nhảy trong công suất lắp đặt",
        "stats": [
          { "value": "5,5 → 16,5 GW", "label": "Điện mặt trời, 2019 → 2020" },
          { "value": "0,6 → 4,0 GW", "label": "Điện gió, 2020 → 2021" },
          { "value": "16,7 GW và 4,1 GW", "label": "Điện mặt trời và điện gió năm 2022" }
        ],
        "body": "Điện mặt trời tăng mạnh trước, điện gió tăng mạnh sau một năm."
      },
      "animationPreset": "data",
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Tóm lại số liệu bằng ba con số dễ nhớ. Nhấn mạnh rằng điện mặt trời có bước nhảy ở giai đoạn 2019 đến 2020, còn điện gió có bước nhảy ở giai đoạn 2020 đến 2021. Số liệu do giảng viên cung cấp, không làm tròn thêm."
    },
    {
      "id": "s7-formula",
      "layout": "codeFocus",
      "content": {
        "eyebrow": "Công thức minh họa",
        "heading": "Công suất của pin mặt trời",
        "formula": { "latex": "P = \\eta \\cdot A \\cdot G" },
        "bullets": [
          "P: công suất của pin mặt trời",
          "η: hiệu suất của pin",
          "A: diện tích pin",
          "G: bức xạ mặt trời"
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "fade", "duration": 500 },
      "notes": "Giải thích công thức theo từng ký hiệu: hiệu suất η, diện tích A và bức xạ G. Từ đó nối lại với địa lý: vùng có bức xạ G lớn như Ninh Thuận và Bình Thuận thì cho công suất cao hơn với cùng diện tích và cùng hiệu suất."
    },
    {
      "id": "s8-challenges",
      "layout": "bento",
      "content": {
        "eyebrow": "Thách thức",
        "heading": "Bốn rào cản đối với năng lượng tái tạo",
        "items": [
          { "title": "Lưới truyền tải quá tải", "text": "Hạ tầng truyền tải chưa theo kịp nguồn mới", "icon": "plug" },
          { "title": "Nguồn không ổn định", "text": "Sản lượng phụ thuộc nắng và gió", "icon": "activity" },
          { "title": "Chi phí lưu trữ cao", "text": "Cần giải pháp tích trữ điện", "icon": "battery-charging" },
          { "title": "Khung giá điện thay đổi", "text": "Tạo bất định cho nhà đầu tư", "icon": "trending-down" }
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "wipe", "direction": "left", "duration": 600 },
      "notes": "Cho sinh viên thảo luận nhóm nhỏ hai phút: thách thức nào mang tính kỹ thuật, thách thức nào mang tính thể chế? Lưới truyền tải quá tải và tính không ổn định của nguồn là kỹ thuật; chi phí lưu trữ cao vừa kỹ thuật vừa kinh tế; khung giá điện thay đổi là thể chế."
    },
    {
      "id": "s9-policy-timeline",
      "layout": "timeline",
      "content": {
        "eyebrow": "Chính sách",
        "heading": "Hai mốc chính sách quan trọng",
        "timeline": {
          "orientation": "horizontal",
          "style": "milestones",
          "items": [
            {
              "date": "2017–2020",
              "title": "Cơ chế giá FIT",
              "text": "Giá mua điện cố định cho năng lượng tái tạo",
              "icon": "banknote"
            },
            {
              "date": "2023",
              "title": "Quy hoạch điện VIII",
              "text": "Ưu tiên điện gió ngoài khơi",
              "icon": "flag",
              "highlight": true
            }
          ]
        }
      },
      "animationPreset": "education",
      "transition": { "type": "push", "direction": "left", "duration": 600 },
      "notes": "Đặt hai mốc cạnh nhau: cơ chế giá FIT giai đoạn 2017 đến 2020 và Quy hoạch điện VIII năm 2023. Gợi ý sinh viên đối chiếu thời kỳ FIT với biểu đồ công suất ở phần trước, đồng thời lưu ý rằng Quy hoạch điện VIII chuyển sự ưu tiên sang điện gió ngoài khơi."
    },
    {
      "id": "s10-offshore-wind",
      "layout": "imageRight",
      "content": {
        "eyebrow": "Định hướng mới",
        "heading": "Quy hoạch điện VIII ưu tiên điện gió ngoài khơi",
        "bullets": [
          "Quy hoạch điện VIII ban hành năm 2023",
          "Điện gió ven biển Nam Trung Bộ và Tây Nam Bộ là nền tảng địa lý",
          "Câu hỏi mở: ưu tiên này có phù hợp với thách thức lưới điện và lưu trữ?"
        ],
        "image": {
          "query": "offshore wind turbines in the sea at sunrise with fishing boat",
          "alt": "Các tua-bin điện gió ngoài khơi trên biển lúc bình minh"
        },
        "caption": "Điện gió ngoài khơi"
      },
      "animationPreset": "education",
      "transition": { "type": "fade", "duration": 600 },
      "notes": "Nhấn mạnh Quy hoạch điện VIII năm 2023 ưu tiên điện gió ngoài khơi. Gợi ý sinh viên liên hệ với vùng gió ven biển Nam Trung Bộ, Tây Nam Bộ và với các thách thức đã học: lưới truyền tải, tính không ổn định và chi phí lưu trữ."
    },
    {
      "id": "s11-discussion",
      "layout": "comparison",
      "content": {
        "eyebrow": "Thảo luận cuối buổi",
        "heading": "Việt Nam nên ưu tiên điện gió ngoài khơi hay điện mặt trời áp mái? Vì sao?",
        "columns": [
          {
            "heading": "Điện gió ngoài khơi",
            "bullets": [
              "Gắn với định hướng của Quy hoạch điện VIII (2023)",
              "Vùng gió: ven biển Nam Trung Bộ, Tây Nam Bộ",
              "Liên hệ: lưới truyền tải và chi phí lưu trữ"
            ]
          },
          {
            "heading": "Điện mặt trời áp mái",
            "bullets": [
              "Dựa trên công thức P = η · A · G",
              "Mặt trời là nguồn có công suất lắp đặt lớn nhất trong số liệu 2019–2022",
              "Liên hệ: tính không ổn định và khung giá điện"
            ]
          }
        ]
      },
      "animationPreset": "education",
      "transition": { "type": "zoom", "duration": 700 },
      "notes": "Chia lớp thành hai nhóm, mỗi nhóm bảo vệ một phương án trong năm phút, sau đó đổi vai. Yêu cầu sinh viên dùng số liệu công suất, các thách thức và chính sách đã học làm luận cứ. Không có đáp án duy nhất; đánh giá chất lượng lập luận."
    },
    {
      "id": "s12-closing",
      "layout": "closing",
      "content": {
        "eyebrow": "Tổng kết",
        "heading": "Cảm ơn các bạn đã lắng nghe",
        "subheading": "Nguồn lực, xu hướng, thách thức và chính sách của năng lượng tái tạo Việt Nam",
        "body": "Giảng viên: TS. Lê Thu Hà",
        "cta": "Chuẩn bị luận cứ cho phần thảo luận"
      },
      "animationPreset": "education",
      "transition": { "type": "fade", "duration": 700 },
      "notes": "Tóm tắt bốn ý: các nguồn năng lượng tái tạo theo vùng, bước nhảy công suất giai đoạn 2019 đến 2022, bốn thách thức và hai mốc chính sách. Mời sinh viên đặt câu hỏi và nhắc lại câu hỏi thảo luận."
    }
  ]
}
```

Lưu ý: tất cả số liệu công suất (GW) lấy đúng từ giảng viên. Ảnh được đề xuất bằng từ khóa tìm kiếm nên SlideCraft sẽ tự chọn ảnh phù hợp.
