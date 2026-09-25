# Qwen gidas: hero animacijos svetainei

Vietinis Qwen gali sukurti animaciją, kuri paleidžiama **atspausdinus** modelį hero scenoje — robotas pamojuoja,
raketa pakyla ir nusileidžia, lempa užsidega. Qwen neliečia `index.php`: kiekviena animacija yra atskiras
mažas failas `models/anims/<modelio id>.js`, kurį svetainė pasikrauna pati.

```
models/anims/robot.js     ← animacija (Qwen parašo)
models/models.json        ← "anim": "robot.js" (skriptas įrašo pats)
```

## 1. Greitas startas

1. **Paleiskite Qwen 3.8** (numatytasis modelis — palyginime greičiausias ir gyviausias): dukart spustelėkite
   `tools\qwen-animation\start_qwen38.bat` → `http://127.0.0.1:1234/v1` (tik GPU1, ~15 GB; GPU0 lieka laisvas).
   Kiti modeliai irgi tinka (bet koks OpenAI suderinamas serveris) — nurodykite `--endpoint`.
   Serveris jau paleidžiamas su **MTP** (`--spec-type draft-mtp --spec-draft-n-max 4`, ~2–3× greičiau) ir 12k mąstymo biudžetu.
   **Numatyta: thinking + `medium`** (savininko vertinimu gražiausi judesiai, bitutė iš 1 bandymo per ~4,5 min). Kiti lygiai:
   `--effort low` (greičiausia ~3,5 min, bet kartais „trumpina“ — pvz. trūkčiojantys sparnai) arba `--effort xhigh`
   (lėčiausia, „permąsto“); be mąstymo — `--no-think`. Qwen 3.6 lygių neturi — jam `--inject-effort low|xhigh`.
2. **Paleiskite generatorių** (iš `<site folder>`):

   ```bash
   python tools/qwen-animation/qwen_anim.py --model gear --idea "krumpliaratis įsisuka kaip mechanizmo detalė" --preview
   ```

   Skriptas pats: surenka modelio faktus → paklausia Qwen → patikrina kodą tikru three.js → jei yra klaidų,
   grąžina jas Qwen pataisyti (iki 3 kartų) → išsaugo `models/anims/gear.js` → atidaro peržiūrą.
3. **Peržiūra**: `http://localhost:8077/index.php?models=preview&scrub&lang=lt` — apačioje atsiranda
   **laiko slankiklis**: tempkite ir žiūrėkite animaciją sekundė po sekundės (▶ — grąžina įprastą eigą).
4. **Patiko?** Įkelkite `models/anims/<id>.js` ir `models/models.json` į serverį (failų tvarkyklė arba deploy).
   Modelį iš atsargos grąžinti į hero: `tools/make_models.py` perkelkite jo eilutę iš `BACKUP_MODELS` į `MODELS`
   ir paleiskite `python tools/make_models.py` (generatorius pats įrašys `"anim"`, jei failas yra).

Naudingi raktai: `--idea` (ką daryti; tuščia — Qwen sugalvos pats), `--rounds 3` (taisymo kartai),
`--think` (Qwen „thinking“ — kartais geresnė idėja, bet lėčiau), `--dry-run` (parodo, ką siųs Qwen).

## 2. Kaip tai veikia (kad žinotumėte, ką prašyti)

**Laiko juosta** (`ctx.e` — sekundės nuo spausdinimo pabaigos):

| e | kas vyksta |
|---|---|
| 0 | dar spausdinama — modelis nejuda |
| 0,5–1,6 s | nulaužiamos atramos |
| **1,7–6,6 s** | **animacija** |
| 6,6–7 s | viskas ramiai grįžę į vietą |
| 7–7,7 s | modelis išnyksta, kraunamas kitas |

Pelę užvedus ant modelio laikas sustoja ties 7 s — todėl animacija turi baigtis ramia padėtimi.

**Ką animacija gali daryti:**
- judinti visą modelį (`ctx.group`): pakelti, pasukti, pašokinti;
- **atskirti dalį** (`ctx.split`) ir sukti ją apie vyrį — ranka, galva, dangtelis, sparnas, ratas;
- pridėti savo objektų (`ctx.extra`): liepsna, dūmai, lemputė, kibirkštys, burbulai;
- šviesa (`ctx.light`) ir švytėjimas (`ctx.mats[i].emissive` — pvz. akys, lempa).

**Kaip gerai paprašyti** (`--idea`): parašykite, *kas* juda, *kaip* ir *kuo baigiasi*. Pvz.:
- „Robotas pakelia dešinę ranką iki galvos ir 3 kartus pamojuoja, galva pakrypsta, akys sužiba; nuleidžia ranką.“
- „Vaza pasisuka 360° ant pagrindo, iš jos išdygsta 3 gėlių žiedai, kurie pražysta ir vėl susiskleidžia.“
- „Krumpliaratis pakyla 1 cm, mažasis krumpliaratis sukasi į vieną pusę, didysis — į kitą, lyg būtų pavara; nusileidžia.“
Kuo tiksliau nurodysite dalis („dešinė ranka“, „viršutinis dangtelis“), tuo tiksliau Qwen jas atskirs — jis
gauna kiekvienos dalies gabaritus ir modelio Python kūrimo kodą iš `make_models.py`.

## 3. Modelių palyginimas

Dukart spustelėkite `tools\qwen-animation\compare.bat` — atsidaro puslapis, kur kiekvienam modeliui (robotas,
raketa, bitutė, kaktusas) yra Claude ir visų išbandytų LLM versijos; apačioje laiko slankiklis.
Naują LLM palyginimui pridėti: paleiskite jo serverį ir
`python tools/qwen-animation/run_compare.py --tag <vardas> --endpoint http://127.0.0.1:1234/v1`
(rezultatai: `models/anims/<vardas>/`, bandymai ir laikas — `_results.json`).

Palyginimo rezultatai (vienodos sąlygos, 2026-09-25):

| LLM | robotas | raketa | bitutė | kaktusas | laikas |
|---|---|---|---|---|---|
| **Qwen 3.8-27B** (numatytasis) | ✓ 1 | ✓ 2 | ⚠ 4 | ✓ 1 | ~7 min |
| Qwen 3.6-27B | ✓ 2 | ✓ 2 | ✓ 2 | ✓ 1 | ~10 min |
| Qwen 3.8 Flash-Next (2×3090) | ✗→✓ 2-as paleidimas | ✓ 3 | ✓ 1 | ✓ 1 | ~14 min |
| Bonsai 2 (ternarinis 27B) | ⚠ 4 | ✓ 2-as paleidimas | ⚠ 4 | ✓ 1 | — |

(skaičius — kiek bandymų prireikė, kol validatorius priėmė; ⚠ — išsaugota su pastabomis)

**Vizualus įvertinimas (savininko):** visose keturiose geriausios Claude animacijos. Bonsai 2 ir Qwen 3.6 — silpnos;
Qwen 3.8 bandė daugiau, bet nepavyko; Flash-Next — dar silpnesnis už 3.8. Išvada: svetainės animacijas rašo Claude,
o vietinis Qwen tinka juodraščiams ir paprastiems judesiams (pakilimas, sukimasis, švytėjimas).

## 4. Failai

| failas | paskirtis |
|---|---|
| `SYSTEM_PROMPT.md` | Qwen instrukcija: taisyklės, `ctx` aprašas, stilius, patikros sąrašas (angliškai — Qwen jas tiksliausiai vykdo) |
| `start_qwen38.bat` | paleidžia numatytąjį Qwen 3.8 serverį (GPU1, :1234) |
| `compare.bat`, `run_compare.py`, `serve.py` | palyginimo puslapis, LLM palyginimo paleidimas, vietinis serveris :8077 |
| `qwen_anim.py` | generatorius: faktai → Qwen → validatorius → taisymas → išsaugojimas → peržiūra |
| `validate.mjs` | tikrintuvas: paleidžia animaciją su tikru three.js ir tokiu pat `ctx`, kaip svetainė; tikrina klaidas, NaN, ar modelis nejuda spausdinant / lūžtant atramoms, ar grįžta į vietą iki 7 s, ar nepakeistos spalvos, greitį |
| `../../models/anims/robot.js`, `rocket.js` | patikrinti pavyzdžiai (įdedami į kiekvieną užklausą — Qwen mokosi iš jų) |

Rankinis patikrinimas: `node tools/qwen-animation/validate.mjs models/anims/robot.js models/robot-1.stl models/robot-2.stl models/robot-3.stl models/robot-4.stl`

## 5. Kai kas nepavyksta

- **„Nepavyko prisijungti“** — Qwen serveris nepaleistas arba kitas prievadas → `--endpoint`.
- **Po 3 bandymų vis klaidos** — juodraštis lieka `models/anims/_draft_<id>.js`; paleiskite dar kartą (kita
  idėja / `--think`), arba atsiųskite jį Claude — pataisys.
- **Dalis atskirta netiksliai** (pvz. su ranka nusineša ir korpuso gabalą) — patikslinkite `--idea`
  („ranka yra u > 0.85, žemiau v 0.6“) arba pataisykite `split(...)` sąlygą faile ranka.
- **Animacija per greita / lėta** — faile pakeiskite laikus `ctx.win(e, 2.0, 2.8)` (pradžia, pabaiga sekundėmis).
- Seną versiją rasite `models/anims/_old/`.
