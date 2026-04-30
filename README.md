<<<<<<< HEAD
# MuseScore MIDI Lejupielādētājs

Šis ir vienkāršs rīks, kas ļauj iegūt lejupielādējamu MIDI failu no MuseScore notis lapas.

## Kā tas darbojas?

Projekts ir sadalīts divās daļās:

1.  **Priekšgals (Frontend):** Tā ir `index.html` lapa, ko lietotājs redz savā pārlūkprogrammā. Šeit lietotājs var ielīmēt saiti uz MuseScore notīm.
2.  **Aizmugure (Backend):** Tas ir `api/get-midi.js` fails, kas darbojas kā "serverless" funkcija uz [Vercel](https://vercel.com/) platformas. Šī funkcija saņem MuseScore saiti no priekšgala.

**Darbības process:**

1.  Lietotājs ievada MuseScore URL adresi `index.html` lapā un nospiež pogu "Iegūt MIDI".
2.  Lapa nosūta šo URL uz `api/get-midi.js` funkciju, kas darbojas uz Vercel servera.
3.  Aizmugures funkcija, izmantojot "headless" pārlūkprogrammu (piemēram, Chromium), atver norādīto MuseScore lapu fonā.
4.  Tā analizē (scrape) lapas saturu, lai atrastu tiešo saiti uz MIDI failu, kas parasti nav publiski redzama.
5.  Kad saite ir atrasta, tā tiek nosūtīta atpakaļ uz priekšgalu.
6.  `index.html` lapa parāda lietotājam lejupielādes saiti.

## Izvietošana (Deployment)

Šo projektu var viegli izvietot uz Vercel platformas:

1.  Izveidojiet jaunu projektu savā Vercel kontā un savienojiet to ar šo GitHub repozitoriju.
2.  Vercel automātiski atpazīs `api` mapi un konfigurēs `get-midi.js` kā serverless funkciju.
3.  `index.html` tiks publicēts kā galvenā lapa.

Nekāda papildu konfigurācija nav nepieciešama.
