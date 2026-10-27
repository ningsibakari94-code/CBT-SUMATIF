import { Question, QuestionAnswerKey, RubricCriteriaAspect } from '../types/cbt';

export const EXAM_METADATA = {
  title: 'CBT Sumatif Matematika Kelas XI',
  subject: 'Matematika SMA/MA Kelas XI',
  topic: 'Fungsi Komposisi dan Fungsi Invers',
  targetLevel: 'SMA/MA Kelas XI',
  totalQuestions: 10,
  maxTotalScore: 38,
  defaultDurationMinutes: 60,
  objectiveQuestionsCount: 8,
  essayQuestionsCount: 2,
  defaultPassScore: 75,
};

export const RUBRIC_ANALYTIC_ASPECTS: RubricCriteriaAspect[] = [
  {
    aspect: 'Identifikasi informasi dan variabel',
    criteria: 'Mengidentifikasi informasi penting, variabel, dan target sesuai konteks.',
    maxScore: 2,
  },
  {
    aspect: 'Pembentukan model matematika',
    criteria: 'Menyusun fungsi/model dan komposisi atau invers yang sesuai.',
    maxScore: 2,
  },
  {
    aspect: 'Proses perhitungan',
    criteria: 'Melakukan substitusi, operasi aljabar, dan perhitungan secara benar dan sistematis.',
    maxScore: 3,
  },
  {
    aspect: 'Penalaran dan interpretasi',
    criteria: 'Memberikan alasan matematis, membandingkan/mengevaluasi hasil, atau menafsirkan hasil dalam konteks.',
    maxScore: 2,
  },
  {
    aspect: 'Kesimpulan',
    criteria: 'Menuliskan kesimpulan yang jelas dan sesuai hasil.',
    maxScore: 1,
  },
];

export const QUESTIONS_DATA: Question[] = [
  {
    id: 1,
    number: 1,
    type: 'pilihan_ganda',
    title: 'Soal 1 — Pilihan Ganda',
    stimulusTitle: 'Stimulus 1 — Menentukan Biaya Pengiriman Paket',
    stimulus:
      'Sebuah jasa pengiriman menetapkan biaya berdasarkan berat paket. Pelanggan membayar biaya awal Rp10.000 dan biaya Rp5.000 untuk setiap kilogram paket. Setelah biaya awal dan biaya berdasarkan berat dihitung, jasa tersebut mengenakan biaya penanganan sebesar 5% dari seluruh biaya pengiriman sebelum penanganan. Rina mengirim paket dengan berat 4 kg.',
    questionText:
      'Model matematika dan biaya akhir yang tepat untuk menggambarkan situasi tersebut adalah ....',
    options: [
      {
        key: 'A',
        text: 'B(x) = 5.000x + 10.000, sehingga biaya akhir Rp30.000.',
      },
      {
        key: 'B',
        text: 'B(x) = 1,05(5.000x) + 10.000, sehingga biaya akhir Rp31.000.',
      },
      {
        key: 'C',
        text: 'B(x) = 1,05(5.000x + 10.000), sehingga biaya akhir Rp31.500.',
      },
      {
        key: 'D',
        text: 'B(x) = 5.000x + 1,05(10.000), sehingga biaya akhir Rp30.500.',
      },
      {
        key: 'E',
        text: 'B(x) = 5.000x + 10.000 + 5%, sehingga biaya akhir Rp30.005.',
      },
    ],
    cognitiveLevel: 'L2 – Aplikasi',
    learningIndicator:
      'Menentukan komposisi dua fungsi linear dalam masalah kontekstual.',
    questionIndicator:
      'Disajikan situasi biaya pengiriman dan biaya penanganan, murid memilih model komposisi yang tepat dan menentukan biaya akhir.',
    sourceContext: 'Stimulus kontekstual orisinal: biaya pengiriman paket.',
    maxScore: 1,
  },
  {
    id: 2,
    number: 2,
    type: 'pilihan_ganda',
    title: 'Soal 2 — Pilihan Ganda',
    stimulusTitle: 'Stimulus 2 — Sensor Jarak pada Robot',
    stimulus:
      'Sebuah robot menggunakan sensor untuk mengubah jarak suatu benda menjadi nilai keluaran. Dalam pengujian, nilai keluaran sensor diperoleh dengan mengalikan jarak benda dengan dirinya sendiri. Robot hanya digunakan untuk mengukur jarak yang tidak negatif. Seorang teknisi ingin membuat sistem yang dapat menentukan kembali jarak benda berdasarkan nilai keluaran sensor.',
    questionText:
      'Alasan matematis yang paling tepat agar proses pembalikan hubungan tersebut dapat dilakukan secara tunggal adalah ....',
    options: [
      {
        key: 'A',
        text: 'Setiap nilai keluaran harus dapat berasal dari dua jarak yang berbeda.',
      },
      {
        key: 'B',
        text: 'Jarak benda harus dibatasi pada bilangan nonnegatif agar setiap keluaran yang dihasilkan mempunyai tepat satu jarak masukan.',
      },
      {
        key: 'C',
        text: 'Semua hubungan kuadrat otomatis mempunyai invers tanpa pembatasan domain.',
      },
      {
        key: 'D',
        text: 'Nilai keluaran harus selalu sama dengan nilai masukan.',
      },
      {
        key: 'E',
        text: 'Pembatasan jarak membuat hubungan kuadrat berubah menjadi hubungan linear.',
      },
    ],
    cognitiveLevel: 'L3 – Penalaran',
    learningIndicator:
      'Menentukan fungsi invers dan memahami syarat keberadaannya.',
    questionIndicator:
      'Disajikan situasi sensor kuadrat dengan masukan nonnegatif, murid mengidentifikasi alasan hubungan dapat dibalik secara tunggal.',
    sourceContext: 'Stimulus kontekstual orisinal: sensor jarak robot.',
    maxScore: 1,
  },
  {
    id: 3,
    number: 3,
    type: 'pgk',
    title: 'Soal 3 — Pilihan Ganda Kompleks (PGK)',
    stimulusTitle: 'Stimulus 3 — Dua Tahap Pengolahan Data di Laboratorium',
    stimulus:
      'Sebuah laboratorium mengolah data pengukuran melalui dua tahap. Pada tahap pertama, suatu bilangan ditambah 1 lalu hasilnya dikalikan 2. Pada tahap kedua, hasil pengolahan dikuadratkan. Laboratorium juga memiliki proses lain yang mengurangi suatu bilangan sebanyak 3 dan proses identitas yang tidak mengubah nilai masukan. Seorang analis ingin membandingkan hasil apabila urutan pengolahan diubah, serta memeriksa apakah pengelompokan proses memengaruhi hasil akhir.',
    questionText: 'Pilihlah semua pernyataan yang benar.',
    options: [
      {
        key: 'A',
        text: 'Jika proses pengkuadratan dilakukan terlebih dahulu, lalu hasilnya dikalikan 2 dan ditambah 2, hasilnya selalu sama dengan melakukan penambahan 1, perkalian 2, lalu pengkuadratan.',
      },
      {
        key: 'B',
        text: 'Urutan dua proses pengolahan dapat memengaruhi hasil akhir.',
      },
      {
        key: 'C',
        text: 'Proses identitas tidak mengubah nilai masukan ketika diterapkan sebelum atau sesudah suatu fungsi.',
      },
      {
        key: 'D',
        text: 'Untuk tiga proses yang komposisinya terdefinisi, perubahan pengelompokan komposisi tidak mengubah hasil akhir.',
      },
      {
        key: 'E',
        text: 'Setiap dua proses matematika pasti menghasilkan nilai yang sama meskipun urutannya ditukar.',
      },
    ],
    cognitiveLevel: 'L3 – Penalaran',
    learningIndicator:
      'Menganalisis sifat komposisi fungsi: nonkomutatif, asosiatif, dan identitas.',
    questionIndicator:
      'Disajikan proses pengolahan data bertahap, murid memilih pernyataan benar tentang urutan, identitas, dan pengelompokan komposisi.',
    sourceContext: 'Stimulus kontekstual orisinal: pengolahan data laboratorium.',
    maxScore: 2,
  },
  {
    id: 4,
    number: 4,
    type: 'pgk',
    title: 'Soal 4 — Pilihan Ganda Kompleks (PGK)',
    stimulusTitle: 'Stimulus 4 — Pertumbuhan Mikroorganisme',
    stimulus:
      'Dalam simulasi laboratorium, pada awal pengamatan terdapat 50 mikroorganisme. Berdasarkan pola pengamatan, jumlah mikroorganisme menjadi dua kali lipat setiap satu jam. Simulasi digunakan untuk memperkirakan jumlah mikroorganisme pada waktu tertentu dan menentukan kapan jumlahnya mencapai target.',
    questionText:
      'Pilihlah semua pernyataan yang benar berdasarkan informasi tersebut.',
    options: [
      {
        key: 'A',
        text: 'Jumlah awal mikroorganisme adalah 50.',
      },
      {
        key: 'B',
        text: 'Setelah 3 jam, jumlah mikroorganisme diperkirakan 400.',
      },
      {
        key: 'C',
        text: 'Jumlah mikroorganisme mencapai 800 setelah 4 jam.',
      },
      {
        key: 'D',
        text: 'Untuk menentukan waktu berdasarkan jumlah mikroorganisme, murid dapat membalik model pertumbuhan dengan menggunakan konsep logaritma.',
      },
      {
        key: 'E',
        text: 'Setelah 2 jam, jumlah mikroorganisme diperkirakan 150.',
      },
    ],
    cognitiveLevel: 'L2 – Aplikasi',
    learningIndicator:
      'Menentukan dan menerapkan fungsi eksponensial serta inversnya.',
    questionIndicator:
      'Disajikan pertumbuhan mikroorganisme yang berlipat dua setiap jam, murid menilai pernyataan tentang jumlah, waktu, dan penggunaan invers.',
    sourceContext: 'Stimulus kontekstual orisinal: simulasi laboratorium.',
    maxScore: 2,
  },
  {
    id: 5,
    number: 5,
    type: 'menjodohkan',
    title: 'Soal 5 — Menjodohkan',
    stimulusTitle: 'Stimulus 5 — Situasi Transaksi dan Perubahan Nilai',
    stimulus:
      'Sebuah koperasi sekolah menggunakan beberapa aturan matematika untuk menghitung transaksi dan perubahan nilai. Identifikasilah hubungan masukan dan keluaran dari setiap situasi, kemudian pasangkan situasi dengan model matematika yang sesuai.',
    questionText:
      'Pasangkan setiap situasi pada Kolom I dengan model pada Kolom II. Setiap pilihan hanya digunakan satu kali dan terdapat satu pilihan yang tidak digunakan.',
    matchingData: {
      columnI: [
        {
          id: '1',
          label: '1',
          text: 'Sebuah barang mendapat potongan harga sebesar 25% dari harga awal.',
        },
        {
          id: '2',
          label: '2',
          text: 'Tabungan awal Rp100.000 menjadi dua kali lipat pada setiap periode.',
        },
        {
          id: '3',
          label: '3',
          text: 'Sebuah mesin mengalikan bilangan masukan dengan 3, kemudian menambahkan 5.',
        },
        {
          id: '4',
          label: '4',
          text: 'Sensor kuadrat menghasilkan nilai keluaran dari kuadrat jarak nonnegatif. Teknisi ingin menentukan kembali jarak berdasarkan nilai keluaran.',
        },
      ],
      columnII: [
        { id: 'A', label: 'A', text: 'y = √x, x ≥ 0' },
        { id: 'B', label: 'B', text: 'y = 100.000(2)^n' },
        { id: 'C', label: 'C', text: 'y = 3x + 5' },
        { id: 'D', label: 'D', text: 'y = 0,75x' },
        { id: 'E', label: 'E', text: 'y = x² + 5' },
      ],
    },
    cognitiveLevel: 'L2 – Aplikasi',
    learningIndicator:
      'Menghubungkan situasi kontekstual dengan model fungsi dan invers.',
    questionIndicator:
      'Murid memasangkan situasi diskon, pertumbuhan tabungan, operasi mesin, dan pembalikan hubungan kuadrat dengan model matematika.',
    sourceContext:
      'Stimulus kontekstual orisinal: transaksi koperasi dan perubahan nilai.',
    maxScore: 4,
  },
  {
    id: 6,
    number: 6,
    type: 'menjodohkan',
    title: 'Soal 6 — Menjodohkan',
    stimulusTitle:
      'Stimulus 6 — Proses Pengolahan Data dan Pemulihan Nilai',
    stimulus:
      'Sebuah pusat pengolahan data menggunakan beberapa prosedur. Prosedur pertama mengubah nilai masukan dengan mengalikan 4 lalu mengurangi 7. Prosedur kedua mengalikan nilai masukan dengan 2 lalu menambahkan 3. Prosedur ketiga mengkuadratkan nilai masukan. Untuk prosedur kuadrat, sistem hanya menerima bilangan nonnegatif agar nilai awal dapat ditentukan kembali secara tunggal. Tim pengembang harus mengidentifikasi model proses dan cara membalik proses tersebut. (Catatan: untuk butir 3, pembalikan dua proses berurutan f dan dilanjutkan g menggunakan aturan (f ∘ g)⁻¹).',
    questionText:
      'Pasangkan setiap kebutuhan pada Kolom I dengan model matematika yang sesuai pada Kolom II. Terdapat satu pilihan yang tidak digunakan.',
    matchingData: {
      columnI: [
        {
          id: '1',
          label: '1',
          text: 'Menentukan nilai masukan jika keluaran dari prosedur pertama diketahui.',
        },
        {
          id: '2',
          label: '2',
          text: 'Menyusun model hasil ketika prosedur kedua dilanjutkan dengan prosedur pengkuadratan.',
        },
        {
          id: '3',
          label: '3',
          text: 'Membalik dua proses berurutan f dilanjutkan g yang masing-masing memiliki invers, yaitu (f ∘ g)⁻¹.',
        },
        {
          id: '4',
          label: '4',
          text: 'Menentukan jarak nonnegatif jika keluaran sensor kuadrat diketahui.',
        },
      ],
      columnII: [
        { id: 'A', label: 'A', text: '(x + 7)/4' },
        { id: 'B', label: 'B', text: '(2x + 3)²' },
        { id: 'C', label: 'C', text: 'g⁻¹ ∘ f⁻¹' },
        { id: 'D', label: 'D', text: '√x' },
        { id: 'E', label: 'E', text: 'f⁻¹ ∘ g⁻¹' },
      ],
    },
    cognitiveLevel: 'L3 – Penalaran',
    learningIndicator:
      'Menentukan komposisi fungsi dan invers dari komposisi fungsi.',
    questionIndicator:
      'Murid memasangkan kebutuhan pengolahan/pemulihan data dengan model fungsi atau invers yang sesuai.',
    sourceContext:
      'Stimulus kontekstual orisinal: sistem pengolahan data.',
    maxScore: 4,
  },
  {
    id: 7,
    number: 7,
    type: 'isian_singkat',
    title: 'Soal 7 — Isian Singkat',
    stimulusTitle: 'Stimulus 7 — Mesin Pengolah Angka',
    stimulus:
      'Sebuah mesin pengolah angka bekerja dalam dua tahap. Tahap pertama mengalikan angka masukan dengan 2, kemudian menambahkan 3. Tahap kedua menggunakan aturan yang belum diketahui. Untuk setiap angka masukan x, hasil akhir kedua tahap selalu sama dengan 4x + 11.',
    questionText:
      'Jika aturan tahap kedua dinyatakan dengan fungsi g, tentukan rumus g(x)!',
    shortAnswerPlaceholder: 'Tuliskan rumus atau fungsi matematika di sini...',
    cognitiveLevel: 'L2 – Aplikasi',
    learningIndicator:
      'Menentukan fungsi pembentuk yang belum diketahui.',
    questionIndicator:
      'Diberikan proses tahap pertama dan hasil akhir komposisi, murid menentukan rumus fungsi tahap kedua.',
    sourceContext: 'Stimulus kontekstual orisinal: mesin pengolah angka.',
    maxScore: 2,
  },
  {
    id: 8,
    number: 8,
    type: 'isian_singkat',
    title: 'Soal 8 — Isian Singkat',
    stimulusTitle: 'Stimulus 8 — Target Tabungan Pendidikan',
    stimulus:
      'Seorang murid memiliki tabungan awal Rp200.000. Saldo tabungan bertambah 5% setiap periode dan tidak ada setoran tambahan maupun penarikan. Murid tersebut ingin mengetahui kapan saldo tabungannya mencapai Rp300.000.',
    questionText:
      'Berapa periode yang diperlukan agar saldo mencapai Rp300.000? Bulatkan jawaban hingga dua angka di belakang koma.',
    shortAnswerPlaceholder: 'Tuliskan angka hasil perhitungan di sini...',
    shortAnswerUnit: 'periode',
    cognitiveLevel: 'L2 – Aplikasi',
    learningIndicator:
      'Menerapkan fungsi invers pada pertumbuhan eksponensial.',
    questionIndicator:
      'Disajikan tabungan dengan pertumbuhan persentase tetap, murid menentukan banyak periode untuk mencapai saldo target.',
    sourceContext:
      'Stimulus kontekstual orisinal: target tabungan pendidikan.',
    maxScore: 2,
  },
  {
    id: 9,
    number: 9,
    type: 'uraian',
    title: 'Soal 9 — Uraian',
    stimulusTitle: 'Stimulus 9 — Menganalisis Biaya Perjalanan Kendaraan',
    stimulus:
      'Sebuah layanan kendaraan menetapkan tarif berdasarkan jarak perjalanan. Penumpang membayar biaya tetap Rp7.000 dan biaya Rp4.000 untuk setiap kilometer yang ditempuh. Setelah biaya perjalanan dihitung, perusahaan mengenakan tambahan layanan sebesar 15% dari seluruh biaya sebelum tambahan layanan. Seorang petugas mengusulkan cara lain: tambahan 15% hanya dikenakan pada biaya berdasarkan jarak, kemudian biaya tetap Rp7.000 ditambahkan. Penumpang ingin mengetahui apakah kedua cara tersebut menghasilkan biaya yang sama untuk perjalanan sejauh 8 km.',
    questionText:
      'Jawablah pertanyaan-pertanyaan berikut dengan menyertakan model matematika, langkah penyelesaian, alasan, dan kesimpulan:',
    essaySubQuestions: [
      {
        id: 'a',
        label: 'a',
        prompt:
          'Tentukan variabel yang digunakan dan susunlah model fungsi untuk menghitung biaya perjalanan sebelum tambahan layanan.',
      },
      {
        id: 'b',
        label: 'b',
        prompt:
          'Susunlah model fungsi untuk proses penambahan biaya layanan sebesar 15%. Jelaskan urutan kedua proses tersebut dan bentuk komposisi fungsi yang dihasilkan.',
      },
      {
        id: 'c',
        label: 'c',
        prompt:
          'Hitung biaya perjalanan sejauh 8 km berdasarkan ketentuan perusahaan.',
      },
      {
        id: 'd',
        label: 'd',
        prompt:
          'Susun model alternatif sesuai usulan petugas dan hitung biayanya untuk perjalanan sejauh 8 km.',
      },
      {
        id: 'e',
        label: 'e',
        prompt:
          'Bandingkan kedua hasil tersebut. Tentukan model yang sesuai dengan ketentuan perusahaan dan berikan alasan matematis yang mendukung kesimpulanmu.',
      },
    ],
    cognitiveLevel: 'L3 – Penalaran',
    learningIndicator:
      'Memodelkan dan mengevaluasi masalah kontekstual menggunakan komposisi fungsi.',
    questionIndicator:
      'Murid membentuk model biaya bertahap, menghitung biaya, membandingkan model alternatif, dan menjelaskan model yang tepat.',
    sourceContext:
      'Stimulus kontekstual orisinal: biaya perjalanan kendaraan.',
    maxScore: 10,
  },
  {
    id: 10,
    number: 10,
    type: 'uraian',
    title: 'Soal 10 — Uraian',
    stimulusTitle:
      'Stimulus 10 — Merencanakan Target Tabungan Pendidikan',
    stimulus:
      'Seorang murid merencanakan tabungan untuk kebutuhan pendidikan. Ia memulai dengan saldo Rp200.000. Setiap periode, saldo bertambah sebesar 5% dari saldo pada awal periode. Selama simulasi, tidak ada setoran tambahan, penarikan, maupun biaya administrasi. Murid tersebut menargetkan saldo Rp300.000. Ia ingin mengetahui waktu yang dibutuhkan untuk mencapai target dan menentukan periode penuh paling awal ketika saldo sudah mencapai atau melampaui target.',
    questionText:
      'Jawablah pertanyaan-pertanyaan berikut dengan menyertakan model matematika, langkah penyelesaian, alasan, dan kesimpulan:',
    essaySubQuestions: [
      {
        id: 'a',
        label: 'a',
        prompt:
          'Misalkan t adalah jumlah periode dan S(t) adalah saldo tabungan. Susunlah model matematika yang menghubungkan saldo dan waktu. Jelaskan alasan pemilihan model tersebut.',
      },
      {
        id: 'b',
        label: 'b',
        prompt:
          'Tentukan fungsi invers yang dapat digunakan untuk memperoleh waktu berdasarkan saldo tabungan.',
      },
      {
        id: 'c',
        label: 'c',
        prompt:
          'Gunakan fungsi invers tersebut untuk menghitung waktu yang diperlukan agar saldo mencapai Rp300.000. Tunjukkan proses perhitunganmu.',
      },
      {
        id: 'd',
        label: 'd',
        prompt:
          'Jika waktu menabung harus berupa bilangan bulat, tentukan periode minimum untuk mencapai atau melampaui target.',
      },
      {
        id: 'e',
        label: 'e',
        prompt:
          'Periksa saldo pada periode sebelum dan pada periode minimum yang kamu pilih. Tuliskan kesimpulan dalam konteks perencanaan tabungan pendidikan.',
      },
    ],
    cognitiveLevel: 'L3 – Penalaran',
    learningIndicator:
      'Menentukan dan menafsirkan fungsi invers dalam masalah kontekstual.',
    questionIndicator:
      'Murid menyusun model pertumbuhan saldo, menentukan invers, menghitung waktu target, dan menafsirkan periode minimum.',
    sourceContext:
      'Stimulus kontekstual orisinal: perencanaan tabungan pendidikan.',
    maxScore: 10,
  },
];

export const ANSWER_KEYS_DATA: Record<number, QuestionAnswerKey> = {
  1: {
    questionId: 1,
    correctChoice: 'C',
    explanation:
      'Biaya sebelum penanganan untuk 4 kg adalah 5.000(4) + 10.000 = Rp30.000. Biaya akhir = 1,05 × 30.000 = Rp31.500. Modelnya B(x) = 1,05(5.000x + 10.000).',
    scoringGuide: 'Benar = 1 poin; Salah / Kosong = 0 poin.',
  },
  2: {
    questionId: 2,
    correctChoice: 'B',
    explanation:
      'Karena jarak dibatasi pada x ≥ 0, setiap nilai keluaran x² yang mungkin memiliki tepat satu masukan nonnegatif. Inversnya adalah akar kuadrat utama.',
    scoringGuide: 'Benar = 1 poin; Salah / Kosong = 0 poin.',
  },
  3: {
    questionId: 3,
    correctChoices: ['B', 'C', 'D'],
    explanation:
      'A salah: tahap pertama menghasilkan 2(x+1), lalu dikuadratkan menjadi [2(x+1)]²; proses kuadrat dahulu lalu dikalikan 2 dan ditambah 2 menghasilkan 2x²+2, tidak selalu sama. B benar karena komposisi umumnya tidak komutatif. C benar untuk fungsi identitas. D benar karena komposisi asosiatif selama terdefinisi. E salah.',
    scoringGuide:
      '2 poin jika memilih tepat B, C, D; 1 poin jika memilih dua dari tiga jawaban benar tanpa memilih pernyataan salah; 0 poin selain itu.',
  },
  4: {
    questionId: 4,
    correctChoices: ['A', 'B', 'C', 'D'],
    explanation:
      'Model pertumbuhan P(t) = 50 · 2^t. P(0) = 50 (A benar), P(3) = 400 (B benar), 800 = 50 · 2^t menghasilkan 2^t = 16 => t = 4 jam (C benar). Waktu dapat ditentukan dengan logaritma (D benar). P(2) = 200, jadi E salah.',
    scoringGuide:
      '2 poin jika memilih tepat A, B, C, D; 1 poin jika memilih tiga jawaban benar tanpa memilih E; 0 poin selain itu.',
  },
  5: {
    questionId: 5,
    correctPairs: {
      '1': 'D',
      '2': 'B',
      '3': 'C',
      '4': 'A',
    },
    explanation:
      '1–D (diskon 25% => bayar 75% harga: y = 0,75x); 2–B (tabungan berlipat dua: y = 100.000(2)^n); 3–C (kali 3 tambah 5: y = 3x + 5); 4–A (pembalikan kuadrat nonnegatif: y = √x, x ≥ 0). Pilihan E tidak digunakan.',
    scoringGuide: '1 poin untuk setiap pasangan benar (maksimum 4 poin).',
  },
  6: {
    questionId: 6,
    correctPairs: {
      '1': 'A',
      '2': 'B',
      '3': 'C',
      '4': 'D',
    },
    explanation:
      '1–A (invers dari 4x - 7 adalah (x + 7)/4); 2–B (prosedur kedua dilanjutkan kuadrat: (2x + 3)²); 3–C (membalik dua proses berturutan: (f ∘ g)⁻¹ = g⁻¹ ∘ f⁻¹); 4–D (invers kuadrat nonnegatif: √x). Pilihan E tidak digunakan.',
    scoringGuide: '1 poin untuk setiap pasangan benar (maksimum 4 poin).',
  },
  7: {
    questionId: 7,
    shortAnswerCanonical: 'g(x) = 2x + 5',
    shortAnswerAcceptable: [
      '2x+5',
      '2x + 5',
      'g(x)=2x+5',
      'g(x) = 2x + 5',
      'g(x)= 2x + 5',
      'g(x) =2x+5',
      '2*x+5',
      '5+2x',
      'g(x)=5+2x',
    ],
    explanation:
      'Tahap 1: f(x) = 2x + 3. Hasil akhir (g ∘ f)(x) = 4x + 11. Misalkan u = 2x + 3, maka x = (u - 3)/2. Substitusi: g(u) = 4((u - 3)/2) + 11 = 2(u - 3) + 11 = 2u - 6 + 11 = 2u + 5. Jadi g(x) = 2x + 5.',
    scoringGuide:
      '2 poin: g(x) = 2x + 5; 1 poin: pendekatan/model sebagian benar dengan kesalahan aljabar kecil; 0 poin: tidak menunjukkan pemahaman.',
  },
  8: {
    questionId: 8,
    shortAnswerCanonical: '8,31',
    shortAnswerAcceptable: ['8.31', '8,31', '8.3', '8,3'],
    shortAnswerNumeric: {
      value: 8.31,
      tolerance: 0.01, // rentang 8.30 s.d. 8.32
    },
    explanation:
      'Model tabungan: S(t) = 200.000(1,05)^t. Menargetkan 300.000: 300.000 = 200.000(1,05)^t => (1,05)^t = 1,5 => t = log(1,5) / log(1,05) = 0,17609 / 0,021189 ≈ 8,31 periode.',
    scoringGuide:
      '2 poin: t ≈ 8,31 (toleransi ±0,01: 8,30 s.d. 8,32); 1 poin: metode invers/logaritma benar tetapi ada kesalahan hitung; 0 poin: jawaban tidak relevan.',
  },
  9: {
    questionId: 9,
    explanation:
      'a. Misalkan x = jarak (km), biaya sebelum tambahan f(x) = 4.000x + 7.000.\nb. Tambahan 15%: g(u) = 1,15u. Urutan f lalu g menghasilkan komposisi (g ∘ f)(x) = 1,15(4.000x + 7.000) = 4.600x + 8.050.\nc. Untuk 8 km: (g ∘ f)(8) = 1,15(4.000(8) + 7.000) = 1,15(39.000) = Rp44.850.\nd. Model alternatif petugas: h(x) = 1,15(4.000x) + 7.000 = 4.600x + 7.000. Untuk 8 km: h(8) = 4.600(8) + 7.000 = 36.800 + 7.000 = Rp43.800.\ne. Selisih Rp44.850 - Rp43.800 = Rp1.050. Komposisi g ∘ f sesuai dengan ketentuan perusahaan karena tambahan layanan 15% dikenakan pada seluruh biaya perjalanan sebelum penanganan (termasuk biaya tetap), bukan hanya biaya per kilometer.',
    scoringGuide:
      'Gunakan rubrik analitik 5 aspek (maksimum 10 poin): Identifikasi (2), Model (2), Hitungan (3), Penalaran (2), Kesimpulan (1).',
  },
  10: {
    questionId: 10,
    explanation:
      'a. S(t) = 200.000(1,05)^t, karena saldo awal Rp200.000 dan setiap periode bertambah 5% sehingga dikalikan faktor (1 + 0,05) = 1,05.\nb. S⁻¹(x) = log(x / 200.000) / log(1,05).\nc. t = log(300.000 / 200.000) / log(1,05) = log(1,5) / log(1,05) ≈ 8,31 periode.\nd. Karena waktu menabung harus bilangan bulat, maka pembulatan ke atas diperlukan: periode minimum adalah 9 periode.\ne. Uji saldo: S(8) = 200.000(1,05)^8 ≈ Rp295.492 (belum mencapai target Rp300.000), sedangkan S(9) = 200.000(1,05)^9 ≈ Rp310.266 (sudah melampaui target). Kesimpulan: Murid harus menabung setidaknya 9 periode penuh agar kebutuhan tabungan pendidikan Rp300.000 terpenuhi.',
    scoringGuide:
      'Gunakan rubrik analitik 5 aspek (maksimum 10 poin): Identifikasi (2), Model (2), Hitungan (3), Penalaran (2), Kesimpulan (1).',
  },
};
