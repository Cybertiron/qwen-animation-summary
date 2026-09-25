@echo off
REM ============================================================
REM  Qwen3.6-27B animacijoms (alternatyva Qwen 3.8)
REM  Tik GPU1 (GPU0 lieka laisvas), ~21 GB VRAM, 48k kontekstas (mąstymui), mąstymo biudžetas 12k.
REM  DFlash n7 + p-min 0.65: mąstymas 40.7 vs 25 ž/s, kodas 56.2 vs 27 ž/s (bench_spec_p2.json).
REM  --mmproj: vaizdo supratimas — qwen_anim.py „akys“ (kadrai + judesio grafikas).
REM  Qwen 3.6 neturi mąstymo lygių — qwen_anim.py rakte naudok --inject-effort low|xhigh (medium = be teksto).
REM  Serveris: http://127.0.0.1:1234/v1  — uždarius langą sustoja.
REM ============================================================
set CUDA_VISIBLE_DEVICES=1
"C:\AI2\llama\llama-server.exe" ^
  -m "C:\AI\llama\Qwen3.6-27B-UD-Q4_K_XL.gguf" ^
  --mmproj "C:\AI\llama\Qwen3.6-27B-mmproj-F16.gguf" ^
  -ngl 99 -c 49152 -fa on -ctk q8_0 -ctv q8_0 ^
  --spec-type draft-dflash -md "C:\AI\llama\Qwen3.6-27B-DFlash-Q8_0.gguf" -ngld 99 ^
  --spec-draft-n-max 7 --spec-draft-p-min 0.65 ^
  --top-p 0.95 --top-k 20 --min-p 0.0 ^
  --reasoning-budget 12000 --reasoning-budget-message "Thinking time is up. Now write the final module in exactly one js code block." ^
  --parallel 1 --no-warmup --jinja --port 1234
echo.
echo === Serveris sustojo. ===
pause
