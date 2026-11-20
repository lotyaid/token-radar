# Strategi Token Radar (token-radar-01) — pendekatan diferensiasi

Disusun 20 Nov 2026 dengan skill `prioritization-frameworks` (borghei/Claude-Skills, terpasang di ~/workspace/custom-skills/).
Arahan user: jangan ambil jalur yang paling ramai — cari sudut yang tidak terpikirkan orang tapi impact-nya besar.
Konteks: 20.766 submission saat scan; kurva hadiah winner-heavy (peringkat 1 = $1.000 dari total $1.325) → diferensiasi adalah segalanya.

## Asumsi skor (RICE)
- Reach: seberapa besar permukaan penilaian/pengguna yang disentuh sudut ini (skala relatif antar-item).
- Impact: 0,25–3 sesuai skala skill (diferensiasi + potensi nilai).
- Confidence: item tanpa sumber tertulis dibatasi 50% (disiplin skill); kit RULES token-radar belum dibaca → belum ada confidence 100% kecuali baseline.
- Effort: hari-kerja Lotya.

## Hasil RICE (scorer resmi skill)
1. **Verdict card per token (WATCH/AVOID + alasan) — 7200**
2. **Rug-risk score jadi headline tiap baris — 4320**
3. Yesterday replay (flag vs hasil nyata) — 1600
4. Generic live board (yang dibuat semua orang) — 1500 ← cuma table stakes
5. Board organik bebas bot — 1400
6. Forensik dev-wallet (serial rugger) — 1125
7. Polish chart/sparkline — 1125
8. Feed smart-money — 750
9. Prediktor probabilitas graduation — 625
10. Momentum klaster naratif — 400

## MoSCoW
- **Must:** board live · rug-risk score tiap token · verdict card · 3 view dashboard (board/detail/filtered) + screenshot
- **Should:** forensik dev-wallet · toggle bebas bot · yesterday replay
- **Could:** prediktor graduation · klaster naratif
- **Won't (siklus ini):** feed smart-money (dependensi data label wallet) · alert live / eksekusi trading

## Konsep entry: "radar keputusan, bukan radar daftar"
Semua orang bikin daftar token baru + chart. Kita bikin satu-satunya radar yang berani bilang **jangan sentuh**: setiap token masuk dengan skor risiko rug sebagai angka utama dan kartu verdict WATCH/AVOID beserta alasannya. Board generik tetap ada (syarat minimal), tapi headline-nya adalah keamanan & keputusan — sudut yang tidak diambil kerumunan, impact-nya besar karena menjawab ketakutan nomor satu pemburu launch: kena rug.

File skor: backlog-rice.json, backlog-moscow.json (folder ini). Langkah berikutnya: unduh kit token-radar-01, baca RULES, sesuaikan confidence, mulai build jalur Must.
