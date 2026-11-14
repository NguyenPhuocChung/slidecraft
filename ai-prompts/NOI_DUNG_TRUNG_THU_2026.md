=== NỘI DUNG THUYẾT TRÌNH CỦA TÔI ===

## A. MỤC ĐÍCH SỬ DỤNG
Bộ slide chiếu trên **màn hình LED/máy chiếu sân khấu** của đêm hội Trung thu ở trường tiểu học & THCS. Khán giả: đại biểu, phụ huynh, thầy cô và **học sinh tiểu học**. MC đứng cạnh sân khấu đọc kịch bản.
- Slide chỉ hiện **tiêu đề lớn, ít chữ, nhìn rõ từ xa** (chữ thân bài ≥ 36px, tiêu đề ≥ 80px).
- **Toàn bộ lời dẫn của MC** đặt vào `notes` (ghi chú diễn giả) của từng slide, giữ nguyên văn và sửa lỗi chính tả.
- Các ghi chú kỹ thuật như "nhạc lên => ra", "ra trụ mới mở nhạc", "MC đứng 1 bên sân khấu" chỉ đưa vào `notes` (dòng đầu, dạng "[Kỹ thuật] …"), **không hiện trên slide**.
- Viết toàn bộ bằng **tiếng Việt có dấu**.

## B. Ý TƯỞNG THIẾT KẾ: "ĐÊM TRĂNG RỐI NƯỚC"
Toàn bộ chương trình như một **buổi diễn múa rối nước dưới trăng rằm**: sân khấu là **thủy đình** mái cong bên ao làng, **chú Tễu** dẫn chuyện, mặt nước lấp lánh ánh trăng và lồng đèn.
- **Tông màu:** đêm xanh thẫm, đỏ son của thủy đình, vàng trăng/vàng kim, xanh ngọc của mặt ao. Dùng đúng khối `theme` sau (cấu hình chủ đề tuỳ chỉnh được SlideCraft hỗ trợ):
```json
"theme": {
  "base": "luxury-black-gold",
  "colors": { "primary": "#C8102E", "secondary": "#1F6F8B", "accent": "#F6C445", "background": "#0B1A33", "surface": "#14284A", "text": "#FFF7E6" },
  "fonts": { "heading": "Playfair Display", "body": "Be Vietnam Pro" }
}
```
- **Họa tiết lặp lại:**
  - mặt nước gợn sóng ở chân slide (`decorative` kind `waves`, colors `["$secondary","$accent"]`, opacity 0.5–0.7);
  - trăng rằm (`decorative` kind `orb`, màu `$accent`) ở góc trên;
  - lồng đèn ông sao (`icon` `star`, nền `$primary`) hoặc hình `star5` màu `$accent`;
  - sen (`decorative` `blob` màu hồng nhạt hoặc ảnh).
  Đặt các họa tiết có chủ ý: không slide nào giống hệt slide nào, nhưng cả bộ phải thống nhất.
- **Hình ảnh** dùng `query` + `alt` bằng tiếng Anh cụ thể, ví dụ:
  - "Vietnamese water puppet theatre pavilion on a pond at night"
  - "Chu Teu water puppet Vietnam"
  - "water puppets dragon splashing water stage"
  - "Vietnamese children holding star lanterns mid-autumn"
  - "full moon over lotus pond night"
  - "mooncakes and tea on a tray"
  - "lion dance mid-autumn festival Vietnam"

  Ảnh nên chiếm khoảng 1/3 số slide, dùng bố cục `hero`, `fullImage`, `cinematic`, `imageLeft`, `imageRight`, `magazine`.
- **Chuyển động:** mềm mại như nước.
  - Chuyển slide chủ yếu `fade`, `dissolve`, `wipe` (như rèm thủy đình kéo lên, direction `up`), thỉnh thoảng `zoom`.
  - Dùng **Morph** cho chuỗi slide tiết mục văn nghệ (trăng và khung tên tiết mục giữ cùng `id`, đổi vị trí/màu giữa các slide).
  - Mỗi slide nội dung có `animationPreset` (`cinematic`, `apple` hoặc `education`) hoặc `animations` riêng.
  - Slide mở đầu có một lồng đèn bay theo đường cong (`motionCurve`) và mặt nước `floatIn`.

## C. CẤU TRÚC GỢI Ý (bám đúng trình tự kịch bản)
1. **Slide mở màn**: "TRUNG THU CHO EM", chủ đề "LỒNG ĐÈN THẮP SÁNG ƯỚC MƠ", Trường TH&THCS Thực hành Sư phạm, năm 2026. Ảnh thủy đình rối nước dưới trăng.
2. **Bài thơ mở đầu** (bố cục chữ lớn tối giản hoặc `quote`):
   "Trung thu trăng sáng như gương, / Trẻ em vui hội, phố phường xôn xao. / Đèn hoa rực rỡ muôn màu, / Tiếng cười em nhỏ hòa cùng trăng thu."
3. **Lý do tổ chức**: một câu thông điệp ngắn "Một đêm hội vui tươi – an toàn – đoàn kết – yêu thương"; toàn văn lời dẫn vào `notes`.
4. **Giới thiệu đại biểu**: ba nhóm.
   - Đại biểu khách mời: 4 ô `[Họ tên – chức vụ]`.
   - Ban đại diện CMHS: Ông Mai Xuân Phương – Trưởng ban Ban đại diện cha mẹ học sinh trường THSP, cộng 2 ô `[Họ tên – chức vụ]`.
   - Lãnh đạo nhà trường: Cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng; Thầy Nguyễn Văn Chương – Phó Hiệu trưởng.
5. **Chương trình đêm hội** (bố cục `agenda`), đánh số lại cho đúng thứ tự:
   1. Tuyên bố lý do – Giới thiệu đại biểu
   2. Phát biểu chào mừng, khai mạc đêm hội
   3. Đọc thư chúc mừng Trung thu của Tổng Bí thư, Chủ tịch nước
   4. Trao học bổng
   5. Thắp đèn, phá cỗ
   6. Biểu diễn văn nghệ
   7. Bế mạc
6. **Phát biểu khai mạc**: Cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng nhà trường.
7. **Thư chúc mừng Trung thu** của Tổng Bí thư, Chủ tịch nước Tô Lâm gửi thiếu nhi cả nước. Người đọc thư: `[Họ tên đại biểu]`. Không tự viết nội dung thư.
8. **"Bán lồng đèn gây quỹ"** do Chi đoàn Thực hành Sư phạm phát động trong 2 tuần. Số tiền quyên góp: `[…… đồng]` (để trống, KHÔNG tự điền số).
9. **Trao học bổng**: mỗi suất gồm 01 học bổng 500.000 đồng và 01 phần bánh trung thu do Bà Trần Tiểu Quyên (phụ huynh em Vưu Nhã Hân, lớp 2D – cơ sở bánh bía Lập Hưng) tài trợ. Danh sách học sinh (dạng thẻ hoặc bảng, chữ to):
   - Huỳnh Trung Tín – 1B cũ
   - Danh Triều Nam Kỳ Anh – 2A cũ
   - Đỗ Trương Khánh Hoàn – 2C cũ
   - Huỳnh Thanh Trí – 3A cũ
   - Lý Ngọc Bảo Trân – 3C cũ
   - Đỗ Trương Kim Hoàn – 4B cũ
   - Bùi Trọng Tâm – 4B cũ
   - Trương Phú Hòa – 4C cũ
   - Nguyễn Minh Đăng – 4C cũ
   - Thêm các ô trống `[Họ tên – lớp]` cho đủ 11 suất.

   Người trao: Cô Dương Thị Mười và Ông Mai Xuân Phương.
10. **Học bổng cho em học sinh khuyết tật Trường Tiểu học Ngọc Tố 1**: 01 suất 500.000 đồng và 01 phần bánh, trích từ quỹ chi đoàn. Phần này chưa chốt nên đặt `"hidden": true` và ghi trong `notes`: "Chưa chốt – bật lại nếu có trao".
11. **Thắp đèn – phá cỗ**, kèm bài thơ: "Đêm nay trăng sáng khắp nơi / Trường ta mở hội Trăng rằm Trung Thu / Thắp đèn sáng toả ngôi sao / Cùng nhau phá cỗ, ngọt ngào tình thân." Người cắt bánh: Cô Dương Thị Mười cùng đồng chí `[Họ tên đại biểu]`.
12. **Mở màn văn nghệ**: lời chào đón các tiết mục.
13. **Mỗi tiết mục một slide** như tấm bảng hiệu của thủy đình rối nước. Hiển thị số thứ tự, tên tiết mục, thể loại, lớp biểu diễn. Các slide này dùng chung một khung thiết kế và nối với nhau bằng Morph. Ghi chú kỹ thuật âm thanh đặt vào `notes`. Danh sách tiết mục:

    | STT | Tiết mục | Thể loại | Lớp biểu diễn | [Kỹ thuật] |
    |---|---|---|---|---|
    | 1 | Trung Thu xuống phố | Múa | Khối 2 | nhạc lên → ra |
    | 2 | Ông trăng miệng cười | Hát múa | Khối 4 | ra trụ mới mở nhạc |
    | 3 | Thùng thình thùng thình + múa lân | Nhảy | Khối 1 | ra trụ trước mới mở nhạc |
    | 4 | Biểu diễn thời trang | Trình diễn | Khối 1 | nhạc lên → ra |

    **Chen sau tiết mục 4: slide "Giao lưu cùng Chị Hằng – Chú Cuội"**, phong cách vui nhộn, có ảnh/hình trăng. Lời dẫn đặt trong `notes`, gồm câu hô "Chị Hằng ơi… Chú Cuội ơi… xuống chơi cùng chúng em!" (2 lần).

    | STT | Tiết mục | Thể loại | Lớp biểu diễn | [Kỹ thuật] |
    |---|---|---|---|---|
    | 5 | Mashup Lý Nam bộ | Nhảy | Khối 3 | ra trụ mới mở nhạc |
    | 6 | Bánh Trung Thu | Múa | Khối 2 | nhạc lên → ra |
    | 7 | Mashup Em bé Việt Nam – Máu đỏ da vàng | Nhảy | 5C, 5D | ra trụ mới mở nhạc |
    | 8 | Hồn Sen Việt | Múa | SV CĐCĐ | mở nhạc → ra |
    | 9 | Trăng ới ời ơi | Nhảy | Khối 3 | ra trụ mới mở nhạc |
    | 10 | Mashup Trung Thu | Múa | Khối 4 | mở nhạc → ra |
    | 11 | Thực hành Sư phạm ơi! | Nhảy | 5A, 5B | nhạc lên → ra |
14. **Bế mạc – cảm ơn**: cảm ơn quý lãnh đạo, doanh nghiệp, cha mẹ học sinh; hẹn gặp lại Trung thu năm sau.
15. **Chụp ảnh lưu niệm**: slide kết thúc đẹp, ảnh lồng đèn và trăng, dòng chữ "Kính mời quý đại biểu, quý thầy cô cùng chụp ảnh lưu niệm".

## D. QUY TẮC RIÊNG CHO TÀI LIỆU NÀY
- **KHÔNG bịa** họ tên, chức vụ, số tiền hay nội dung thư. Chỗ còn trống ("………") thì giữ dạng ô điền sau trong ngoặc vuông, ví dụ `[Họ tên – chức vụ]`.
- Bỏ các ghi chú nội bộ như "=> CÓ LÀM KO ĐỂ CHỈNH LẠI" khỏi slide (chỉ phản ánh vào `notes` của slide ẩn).
- Sửa lỗi chính tả trong lời dẫn: "Kết thức" → "Kết thúc", "them lời ca" → "thêm lời ca", "quí" → "quý", bỏ "ak/ah" và dấu "!!!!" lặp.
- Không dùng biểu đồ (tài liệu không có số liệu thống kê).
- Tổng khoảng 26–28 slide. Nếu JSON quá dài, chia thành nhiều phần (`part`) theo đúng hướng dẫn ở trên.

## E. TOÀN VĂN KỊCH BẢN MC (đưa vào notes theo từng phần)

I. TUYÊN BỐ LÝ DO
Kính thưa quý đại biểu, quý phụ huynh, quý thầy cô giáo và các em học sinh thân mến!
"Trung thu trăng sáng như gương, Trẻ em vui hội, phố phường xôn xao. Đèn hoa rực rỡ muôn màu, Tiếng cười em nhỏ hòa cùng trăng thu."
Khi những cơn gió dịu dàng của mùa thu khẽ về, khi ánh trăng tháng Tám bắt đầu tròn đầy trên bầu trời, cũng là lúc trong lòng mỗi chúng ta lại ngân lên những giai điệu thật thân thương về Tết Trung thu – Tết của thiếu nhi, Tết của đoàn viên và yêu thương.
Kính thưa quý vị! Có lẽ trong ký ức tuổi thơ của mỗi người, Trung thu luôn là một miền ký ức thật đẹp. Đó là đêm trăng sáng, là chiếc đèn ông sao lung linh trên tay, là tiếng trống tùng… tùng… tùng… rộn ràng gọi hội; là những bước chân háo hức theo đoàn múa lân, là tiếng cười trong trẻo của trẻ thơ và là khoảnh khắc cả gia đình cùng quây quần bên mâm cỗ trông trăng.
Và hôm nay, những ký ức đẹp đẽ ấy lại được viết tiếp bằng niềm vui, sự háo hức và những nụ cười của các em học sinh Trường TH&THCS Thực hành Sư phạm. Trong không khí vui tươi, ấm áp của mùa Trung thu năm nay, với mong muốn mang đến cho các em một đêm hội vui tươi – an toàn – đoàn kết – yêu thương, đồng thời tạo nên một sân chơi bổ ích để các em được vui chơi, giao lưu và lưu giữ những kỷ niệm đẹp của tuổi thơ, đó chính là lý do để Trường TH&THCS Thực hành Sư phạm long trọng tổ chức chương trình văn nghệ "TRUNG THU CHO EM" với chủ đề "LỒNG ĐÈN THẮP SÁNG ƯỚC MƠ", năm 2026.

GIỚI THIỆU ĐẠI BIỂU
Đến với chương trình văn nghệ "Trung thu cho em", chủ đề "Lồng đèn thắp sáng ước mơ" năm 2026:
- Về phía đại biểu khách mời, chúng tôi xin trân trọng giới thiệu và đón tiếp: Đ/c [……] (4 vị).
- Về phía Ban Đại diện CMHS trường Thực hành Sư phạm: Ông Mai Xuân Phương – Trưởng ban Ban đại diện cha mẹ học sinh trường THSP; Ông (bà) [……]; Ông (bà) [……].
- Về phía lãnh đạo nhà trường: Cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng nhà trường Thực hành Sư phạm; Thầy Nguyễn Văn Chương – Phó Hiệu trưởng nhà trường.
Cùng toàn thể giáo viên, nhân viên, phó, trưởng ban đại diện cha mẹ học sinh các lớp và tất cả các em học sinh tiểu học trường TH&THCS THSP cùng dự đông đủ. Đề nghị chúng ta hoan nghênh chung!

II. THÔNG QUA CHƯƠNG TRÌNH
Sau đây, tôi xin được phép thông qua nội dung chương trình văn nghệ "Trung thu cho em" chủ đề "Lồng đèn thắp sáng ước mơ" năm 2026 của trường Thực hành Sư phạm (7 mục như mục C.5).

PHÁT BIỂU KHAI MẠC
Để mở đầu cho buổi họp mặt mừng Tết Trung thu, xin trân trọng giới thiệu và kính mời cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng trường THSP phát biểu chào mừng, khai mạc chương trình. — Xin cảm ơn cô Dương Thị Mười với phần phát biểu rất ý nghĩa.

ĐỌC THƯ CHÚC MỪNG
Các em học sinh thân mến! Lúc sinh thời Bác Hồ kính yêu đã luôn dành cho trẻ thơ những tình cảm tốt đẹp nhất. Cứ mỗi dịp Tết Trung thu Bác lại gửi thư cho các cháu thiếu nhi. Phát huy truyền thống tốt đẹp đó, với niềm yêu quý và chăm lo cho tuổi thơ, khi Bác đi xa các bác lãnh đạo Đảng, Nhà nước vẫn luôn quan tâm đến trẻ thơ mỗi dịp Trung thu về. Trung thu năm nay Bác Tô Lâm – Tổng Bí thư, Chủ tịch nước đã gửi thư khen ngợi, động viên và chúc Tết các cháu thiếu nhi. Sau đây xin trân trọng giới thiệu và kính mời đồng chí [……] lên đọc thư của Tổng Bí thư, Chủ tịch nước gửi thiếu nhi cả nước. Trân trọng kính mời đồng chí! — Xin cảm ơn lãnh đạo phường đã đọc thư chúc mừng Trung thu của Chủ tịch nước cho các bạn học sinh trường THSP.

PHÁT HỌC BỔNG TỪ PHONG TRÀO BÁN LỒNG ĐÈN GÂY QUỸ
Kính thưa quý đại biểu, quý phụ huynh, quý thầy cô cùng các em học sinh thân mến! Trong hai tuần vừa qua, Chi đoàn Thực hành Sư phạm đã phát động phong trào bán lồng đèn gây quỹ tặng học bổng cho học sinh khó khăn trong nhà trường vào dịp Trung thu. Mỗi chiếc lồng đèn bán ra không chỉ đem lại niềm vui cho các bạn nhỏ mà còn góp thêm một phần bé nhỏ để các bạn học sinh có hoàn cảnh khó khăn trong nhà trường có được một mùa Trung thu trọn vẹn nhất. Phong trào được quý phụ huynh và các em học sinh ủng hộ nhiệt tình. Kết thúc chương trình, ban tổ chức đã thu được số tiền đóng góp vào quỹ học bổng là [……] đồng. Một lần nữa xin cảm ơn và ghi nhận tấm lòng của quý phụ huynh và các em học sinh đã tích cực tham gia, góp phần tạo nên thành công ngoài mong đợi của hoạt động Bán lồng đèn gây quỹ do chi đoàn tổ chức.
Sau đây, cô xin mời [……] em học sinh có tên lên sân khấu để nhận những món quà Trung thu yêu thương. Mỗi phần quà gồm 01 suất học bổng trị giá 500.000 đồng và 01 phần bánh Trung thu do Bà Trần Tiểu Quyên – phụ huynh em Vưu Nhã Hân, lớp 2D (cơ sở bánh bía Lập Hưng) tài trợ. Cô mời các em: (danh sách ở mục C.9).
Xin mời cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng nhà trường và Ông Mai Xuân Phương – Trưởng ban Ban đại diện cha mẹ học sinh trường TH&THCS THSP lên trao những phần quà Trung thu ý nghĩa cho các bạn nhỏ. — Xin cảm ơn cô Dương Thị Mười và Ông Mai Xuân Phương.
(Phần chưa chốt) Ngoài 11 phần quà được trao cho học sinh khó khăn của trường THSP, chi đoàn còn trích quỹ tặng 01 suất học bổng trị giá 500.000 đồng và 01 phần bánh cho 01 em học sinh khuyết tật của Trường Tiểu học Ngọc Tố 1. Một lần nữa xin cảm ơn hoạt động ý nghĩa của chi đoàn, chúc cho các em học sinh khó khăn có một mùa Trung thu trọn vẹn, đong đầy yêu thương.

THẮP ĐÈN TRUNG THU – PHÁ CỖ
[Kỹ thuật] MC đứng một bên sân khấu để đọc.
Kính thưa quý đại biểu, quý phụ huynh, quý thầy cô giáo cùng các em học sinh thân mến! Tiếp theo chương trình là phần thắp đèn – phá cỗ. Một lần nữa xin kính mời cô Dương Thị Mười – Hiệu trưởng nhà trường bước lên sân khấu để thực hiện nghi thức thắp đèn Trung thu với các em học sinh! (Các bạn nhỏ ơi, hãy cùng nhau thắp sáng những chiếc lồng đèn xinh xắn cùng cô Mười nào!)
"Đêm nay trăng sáng khắp nơi / Trường ta mở hội Trăng rằm Trung Thu / Thắp đèn sáng toả ngôi sao / Cùng nhau phá cỗ, ngọt ngào tình thân."
Sau đây xin phép mời lên sân khấu: Đồng chí [……] cùng với cô Dương Thị Mười – Bí thư Đảng bộ, Hiệu trưởng nhà trường bước đến vị trí đặt mâm cỗ để cắt bánh Trung thu! (Đoàn viên đi mời bánh đại biểu.) — Xin cảm ơn cô Dương Thị Mười và đồng chí [……]. Xin phép mời quý đại biểu, quý cha mẹ học sinh, quý thầy cô giáo cùng các em học sinh phá cỗ vui Trung thu và thưởng thức những chiếc bánh ngon cùng với nhà trường.

VĂN NGHỆ
Các em thân mến! Trăng rằm đã sáng, đèn lồng đã lung linh, và đêm hội Trung thu của chúng ta càng thêm rộn ràng khi có thêm lời ca, tiếng hát. Ngay sau đây, xin mời quý vị đại biểu, quý thầy cô, quý phụ huynh cùng các em thưởng thức những tiết mục văn nghệ thật vui tươi, đặc sắc trong chương trình "Trung thu cho em – Lồng đèn thắp sáng ước mơ". Xin dành một tràng pháo tay thật lớn chào đón các tiết mục văn nghệ do các bạn học sinh trong đội văn nghệ nhà trường biểu diễn!

GIAO LƯU CÙNG CHỊ HẰNG – CHÚ CUỘI
Các em thân mến! Đêm Trung thu sẽ thật thiếu vắng nếu chỉ có trăng sáng, đèn xinh mà thiếu đi hai người bạn đặc biệt đã gắn liền với tuổi thơ của chúng ta. Các em có biết đó là ai không? Đúng rồi! Là Chị Hằng và Chú Cuội! Nghe nói hôm nay, hai người bạn ấy đã rời cung trăng, vượt qua cả một chặng đường xa để xuống đây vui Trung thu cùng chúng ta đấy! Nhưng… họ đang ở đâu nhỉ? Chúng ta hãy cùng hô to để Chị Hằng và Chú Cuội xuống chơi cùng chúng ta nào: "Chị Hằng ơi… Chú Cuội ơi… xuống chơi cùng chúng em!" (2 lần)
Kết thúc giao lưu: Tạm biệt Chú Cuội và Chị Hằng về cung trăng, chúng ta cùng nhau tiếp tục thưởng thức các tiết mục văn nghệ đặc sắc của chương trình "Trung thu cho em".

BẾ MẠC
Kính thưa quý đại biểu, khách quý, quý thầy cô giáo và các em học sinh thân mến! Để có buổi Trung thu thành công như ngày hôm nay, ngoài sự chuẩn bị chu đáo từ phía nhà trường là sự đồng hành từ quý lãnh đạo, doanh nghiệp, quý cha mẹ học sinh trường TH&THCS Thực hành Sư phạm. Một lần nữa xin chân thành cảm ơn quý vị đại biểu, quý phụ huynh, quý thầy cô giáo cùng các em học sinh đã tranh thủ thời gian đến đây để tham dự chương trình văn nghệ "Trung thu cho em", chủ đề "Lồng đèn thắp sáng ước mơ" năm 2026 của trường Thực hành Sư phạm. Chương trình đến đây là kết thúc. Xin chào tạm biệt và hẹn gặp lại các em vào Tết Trung thu năm sau!
Kính mời quý lãnh đạo, quý đại biểu, quý thầy cô cùng chụp ảnh lưu niệm với nhà trường!
