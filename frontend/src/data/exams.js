export const speakingParts = [
  {id:'read',number:1,title:'Đọc to đoạn văn',english:'Read a Text Aloud',range:'Câu 1–2',prep:45,answer:45,icon:'book-open',color:'blue',description:'Rèn phát âm, ngữ điệu và nhịp đọc theo một thông báo công sở.',count:3},
  {id:'picture',number:2,title:'Mô tả bức tranh',english:'Describe a Picture',range:'Câu 3–4',prep:45,answer:30,icon:'image',color:'mint',description:'Quan sát ảnh, mô tả nhân vật, hành động và bối cảnh.',count:3},
  {id:'questions',number:3,title:'Trả lời câu hỏi',english:'Respond to Questions',range:'Câu 5–7',prep:3,answer:15,icon:'messages-square',color:'violet',description:'Trả lời các câu hỏi giao tiếp theo ngữ cảnh hàng ngày.',count:3},
  {id:'information',number:4,title:'Dùng thông tin trả lời',english:'Use Information Provided',range:'Câu 8–10',prep:3,answer:15,icon:'calendar-days',color:'orange',description:'Đọc lịch trình hoặc bảng thông tin và trả lời chính xác.',count:3},
  {id:'opinion',number:5,title:'Nêu ý kiến',english:'Express an Opinion',range:'Câu 11',prep:45,answer:60,icon:'lightbulb',color:'rose',description:'Bảo vệ quan điểm bằng lý do và ví dụ cụ thể.',count:3},
  {id:'solution',number:6,title:'Đề xuất giải pháp',english:'Propose a Solution',range:'Bài luyện bổ sung',prep:30,answer:60,icon:'badge-help',color:'amber',description:'Bài luyện mở rộng theo định dạng cũ, không thuộc đề thi hiện hành.',count:2,legacy:true},
]

export const writingParts = [
  {id:'picture',number:1,title:'Viết câu theo tranh',english:'Write a Sentence Based on a Picture',range:'Câu 1–5',limit:'8 phút / 5 câu',icon:'image',color:'blue',description:'Quan sát bức tranh và viết một câu chứa đủ hai từ khóa.',count:5},
  {id:'email',number:2,title:'Trả lời email',english:'Respond to a Written Request',range:'Câu 6–7',limit:'10 phút / email',icon:'mail',color:'violet',description:'Viết email công việc, phản hồi đủ các yêu cầu trong đề.',count:3},
  {id:'essay',number:3,title:'Viết bài luận',english:'Write an Opinion Essay',range:'Câu 8',limit:'30 phút',icon:'pen-line',color:'orange',description:'Trình bày quan điểm, lý lẽ, ví dụ và kết luận mạch lạc.',count:3},
]

// Original practice material; no copied paid exam questions.
export const pictureAssets={
  meeting:'/images/meeting.jpg',
  office:'/images/office.jpg',
  cafe:'/images/cafe.jpg',
  work:'/images/work.jpg',
  library:'/images/library.jpg',
}

export const speakingExercises={
  read:[
    {id:'sr01',title:'Thông báo thư viện',text:'Good morning, everyone. Our city library will be closed next Monday for maintenance. We apologize for any inconvenience. Please return your borrowed books by Sunday evening, or use our online renewal service at any time. Thank you for your understanding.',sample:'Đọc rõ từ maintenance, inconvenience và online renewal; nhấn thông tin thời gian.',vocabulary:['maintenance','renewal','inconvenience']},
    {id:'sr02',title:'Sự kiện công ty',text:'Attention, all employees. The annual company picnic will take place at Riverside Park this Saturday. Lunch and transportation will be provided free of charge. Please sign up with the human resources department by Wednesday afternoon. We look forward to seeing you there.',sample:'Ngắt nhịp sau các dấu câu và nhấn annual company picnic.',vocabulary:['annual','transportation','department']},
    {id:'sr03',title:'Cửa hàng sách mới',text:'A new bookstore is opening downtown this Friday. Customers will receive a twenty percent discount on all best-selling books during our first week. The store also features a quiet reading area and a small coffee shop. Visit us and enjoy a wonderful new reading experience.',sample:'Thể hiện ngữ điệu thông báo thân thiện, không nuốt phụ âm cuối.',vocabulary:['discount','downtown','features']},
  ],
  picture:[
    {id:'sp01',title:'Nhóm làm việc',image:pictureAssets.meeting,sample:'Several coworkers are sitting around a table and discussing a project. They seem focused on their work.',vocabulary:['coworkers','discussing','focused']},
    {id:'sp02',title:'Văn phòng sáng sủa',image:pictureAssets.office,sample:'This is a bright modern office with large windows. The desks are arranged in an open workspace.',vocabulary:['workspace','arranged','bright']},
    {id:'sp03',title:'Quán cà phê',image:pictureAssets.cafe,sample:'I can see a cozy café with several tables and chairs. The atmosphere looks peaceful and welcoming.',vocabulary:['cozy','atmosphere','peaceful']},
  ],
  questions:[
    {id:'sq01',title:'Đi lại hàng ngày',question:'How do you usually get to school or work?',sample:'I usually take the bus because it is affordable and convenient.',vocabulary:['commute','convenient','usually']},
    {id:'sq02',title:'Mua sắm',question:'What kind of stores do you like to visit on weekends?',sample:'I like visiting bookstores because I enjoy finding new novels and magazines.',vocabulary:['weekends','prefer','bookstores']},
    {id:'sq03',title:'Thể thao',question:'How often do you exercise, and what do you do?',sample:'I exercise three times a week. I usually go jogging in a park near my home.',vocabulary:['exercise','jogging','weekly']},
  ],
  information:[
    {id:'si01',title:'Lịch hội thảo kỹ năng',schedule:[['09:00','Welcome & Registration','Hall A'],['10:00','Leadership Skills','Room 201'],['11:30','Communication Workshop','Room 203'],['14:00','Team Project Session','Hall B']],question:'What time does the communication workshop begin, and where is it held?',sample:'The communication workshop starts at 11:30 a.m. in Room 203.',vocabulary:['workshop','session','registration']},
    {id:'si02',title:'Lịch xe đưa đón',schedule:[['08:15','North Station','Platform 1'],['09:00','City Center','Platform 2'],['09:40','Airport Terminal','Platform 4']],question:'When does the bus leave for the airport terminal?',sample:'The airport bus leaves at 9:40 a.m. from Platform 4.',vocabulary:['terminal','platform','departure']},
    {id:'si03',title:'Khóa đào tạo nhân sự',schedule:[['Monday','Excel Basics','Online'],['Wednesday','Presentation Skills','Room B'],['Friday','Team Leadership','Room A']],question:'Where will the presentation skills class take place?',sample:'The presentation skills class will take place in Room B on Wednesday.',vocabulary:['presentation','leadership','training']},
  ],
  opinion:[
    {id:'so01',title:'Làm việc tại nhà',question:'Do you think working from home is more productive than working in an office? Explain your opinion with reasons and examples.',sample:'I believe working from home can be more productive because it reduces commuting time. However, teamwork may be easier at the office.',vocabulary:['productive','commuting','collaboration']},
    {id:'so02',title:'Học qua mạng',question:'Do you prefer taking online courses or attending in-person classes? Why?',sample:'I prefer in-person classes because I can interact with teachers and ask questions immediately.',vocabulary:['interactive','flexibility','immediately']},
    {id:'so03',title:'Hoạt động tình nguyện',question:'Should companies encourage their employees to participate in community service? Give reasons for your answer.',sample:'Yes, because volunteering helps employees build stronger relationships and contribute to their communities.',vocabulary:['volunteering','community','encourage']},
  ],
  solution:[
    {id:'ss01',title:'Họp bị hoãn',question:'A meeting room is suddenly unavailable just before a client presentation. Suggest a solution to your manager.',sample:'I suggest booking the small conference room or holding the presentation online.',vocabulary:['unavailable','presentation','suggest']},
    {id:'ss02',title:'Đơn hàng giao chậm',question:'A customer called because an important order is delayed. Offer an appropriate solution.',sample:'I am sorry for the delay. I can arrange express delivery at no extra cost.',vocabulary:['delayed','arrange','delivery']},
  ],
}

export const writingExercises={
  picture:[
    {id:'wp01',title:'Cuộc họp nhóm',image:pictureAssets.meeting,keywords:['people','meeting'],sample:'Several people are having a meeting around a large table.'},
    {id:'wp02',title:'Không gian làm việc',image:pictureAssets.office,keywords:['office','window'],sample:'The office has large windows that let in natural light.'},
    {id:'wp03',title:'Quán cà phê',image:pictureAssets.cafe,keywords:['tables','café'],sample:'Several tables are arranged neatly inside the café.'},
    {id:'wp04',title:'Đồng nghiệp',image:pictureAssets.work,keywords:['employees','discuss'],sample:'The employees are discussing a project at work.'},
    {id:'wp05',title:'Thư viện',image:pictureAssets.library,keywords:['books','shelves'],sample:'Many books are neatly arranged on the library shelves.'},
  ],
  email:[
    {id:'we01',title:'Thư mời hội thảo',sender:'Anna Miller — Training Coordinator',subject:'Upcoming Training Workshop',text:'Dear colleague,\n\nWe are organizing a training workshop next Thursday at 2:00 PM. Please reply to confirm whether you can attend. We would also appreciate any suggestions for additional topics you would like us to cover. Finally, let us know whether you need a laptop or any special equipment.\n\nBest regards,\nAnna',requirements:['Confirm whether you can attend the workshop.','Suggest one additional topic for the workshop.','State whether you need a laptop or other equipment.'],requirementsVi:['Xác nhận có thể tham dự hay không','Đề xuất thêm một chủ đề đào tạo','Nêu rõ nhu cầu về thiết bị'],sample:'Dear Anna,\n\nThank you for the invitation. I am happy to confirm that I can attend next Thursday at 2:00 PM. I would like to suggest a session about resolving conflicts at work. I do not need any special equipment.\n\nBest regards,\nSang'},
    {id:'we02',title:'Khách hàng phản hồi',sender:'James Kim — Customer Relations',subject:'Order Delivery Question',text:'Hello,\n\nI ordered a desk lamp last week, but it has not arrived yet. Could you let me know when it will be delivered? I would also like to know whether I can change the delivery address. Thank you,\nJames',requirements:['Apologize for the delay and acknowledge the problem.','Explain how the customer can get an updated delivery date.','Answer the question about changing the delivery address.'],requirementsVi:['Xin lỗi và ghi nhận việc giao chậm','Cung cấp thông tin hoặc bước xác minh ngày giao','Trả lời về việc đổi địa chỉ nhận hàng'],sample:'Dear James,\n\nI apologize for the delay. I will check the shipment status and send you an updated delivery estimate today. You may change the delivery address if the parcel has not been dispatched. Please send us your new address.\n\nKind regards,\nCustomer Support'},
    {id:'we03',title:'Lên lịch họp nhóm',sender:'Linda Park — Project Manager',subject:'Monthly Project Review',text:'Hi team,\n\nWe need to schedule our monthly project review. Please tell me which day next week works best for you, suggest one topic we should discuss, and let me know if you need any documents in advance. Thanks,\nLinda',requirements:['Choose a suitable day for the meeting.','Suggest one topic to discuss.','Explain which documents you would like to receive in advance, if any.'],requirementsVi:['Chọn ngày thích hợp','Đề xuất chủ đề thảo luận','Yêu cầu tài liệu nếu cần'],sample:'Hi Linda,\n\nTuesday afternoon works best for me. I would like to discuss our project milestones and the current timeline. Could you send the latest progress report before the meeting?\n\nBest,\nSang'},
  ],
  essay:[
    {id:'wa01',title:'Làm việc từ xa',question:'Do you agree or disagree that working from home is better for employees than working in an office? Give specific reasons and examples.',prompts:['Nêu quan điểm rõ ràng','Giải thích ít nhất 2 lý do','Đưa ví dụ cụ thể và kết luận'],sample:'In my opinion, working from home can benefit employees because it saves commuting time and offers greater flexibility. However, offices remain valuable for collaboration. A balanced hybrid model can provide the advantages of both arrangements.'},
    {id:'wa02',title:'Đào tạo nhân viên',question:'Some companies invest heavily in employee training, while others prefer to hire people who already have the required skills. Which approach do you think is better?',prompts:['Chọn một phương án','Phân tích lợi ích và hạn chế','Đưa ví dụ minh họa'],sample:'I believe companies should invest in employee training. Training helps staff adapt to company procedures and improves loyalty. For example, a new employee who receives mentoring often becomes productive more quickly.'},
    {id:'wa03',title:'Giao thông công cộng',question:'Should governments spend more money on public transportation instead of building new roads? Support your opinion with reasons and examples.',prompts:['Thể hiện lập trường','Lý do về môi trường hoặc chi phí','Ví dụ và kết luận'],sample:'I think public transportation deserves more investment. Reliable buses and trains can reduce traffic congestion and pollution while making travel affordable for more people.'},
  ],
}

const from=(category,index)=>speakingExercises[category][index%speakingExercises[category].length]

/** Official current 11-question structure. Q8-10 share the same printed schedule. */
export const speakingMock=[
  {number:1,part:'read',prep:45,answer:45,...from('read',0)},
  {number:2,part:'read',prep:45,answer:45,...from('read',1)},
  {number:3,part:'picture',prep:45,answer:30,...from('picture',0)},
  {number:4,part:'picture',prep:45,answer:30,...from('picture',1)},
  {number:5,part:'questions',prep:3,answer:15,...from('questions',0)},
  {number:6,part:'questions',prep:3,answer:15,...from('questions',1)},
  {number:7,part:'questions',prep:3,answer:30,...from('questions',2)},
  {number:8,part:'information',prep:48,answer:15,...from('information',0),question:'What time does the leadership skills session start?'},
  {number:9,part:'information',prep:3,answer:15,...from('information',0),question:'Where is the communication workshop held?'},
  {number:10,part:'information',prep:3,answer:30,...from('information',0),question:'Please describe the events scheduled after lunch.'},
  {number:11,part:'opinion',prep:45,answer:60,...from('opinion',0)},
]

/** Five pictures share 8 min; two emails take 10 min each; essay takes 30 min. */
export const writingMock=[...writingExercises.picture.map((item,i)=>({...item,number:i+1,part:'picture',limit:480})),...writingExercises.email.slice(0,2).map((item,i)=>({...item,number:i+6,part:'email',limit:600})),{...writingExercises.essay[0],number:8,part:'essay',limit:1800}]
