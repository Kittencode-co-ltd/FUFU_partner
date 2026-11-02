# FUFU website feature mapping

Source review: the FUFU Pet Care POC proposal at `C:\Users\ASUS\Downloads\Draft 2 Form-TYS(POC)-Proposal FUFU Pet Care .docx`, the live FUFU web app source and `FEATURES.md`, and the FUFU Partner MVP `README.md`, `DECISIONS.md`, and production navigation.

## Current app capabilities represented on the site

| Website content | Evidence in the app | Website wording |
| --- | --- | --- |
| Pet profiles and care history | Pet, health record, and vaccination screens and APIs in `FUFU-app-web/src/app` | Create a pet profile; keep health and vaccine records together |
| AI image screening | Pet selection and symptom screen in `FUFU-app-web/src/app/(shell)/scan/page.tsx`, image capture, `/api/scan`, `src/lib/screening.ts` and the result page | Screen images of eyes, ears, teeth/mouth, and skin; the app combines supported model output with symptom answers and shows one of four preliminary urgency levels |
| FUFU AI chat | Chat screen and `/api/chat`; route uses Gemini 2.5 Flash, conversation history, and a guidance prompt | Ask FUFU AI for general pet-care guidance; it does not replace veterinary care |
| Clinic discovery and appointment requests | Vet discovery and booking screens, `/api/vets`, `/api/appointments` | Find clinics and request an appointment |
| Shops, services, and rewards | Shop, service, and reward app routes and APIs | Connect the care journey with shops and pet services |

## Current Partner MVP capabilities represented

| Website content | Evidence | Scope shown |
| --- | --- | --- |
| Appointment calendar and requests | `FUFU_partner/README.md`, production navigation, and appointments MVP module | Manage appointment requests and calendar |
| Visiting pets and visit summaries | Production navigation and MVP visit summary module | Review pets visiting the clinic and record visit summaries |
| Clinic profile | Clinic profile is listed in the production MVP navigation and handled by `clinic-profile.js` | Maintain clinic details |
| Screening referrals | `FUFU-app-web/src/app/scan/result/page.tsx` and `/api/screening-referrals`; Partner `screenings-mvp.js` is in the production MVP navigation | Owners can select a clinic and consent to send screening information; clinics can review the case. The site's interface notes that a veterinarian makes the final assessment |
| Partner sign-in | Existing `public/login.html` and Supabase Auth flow | The site links to the existing partner sign-in; it creates no new authentication system |

## Proposal Draft 2: current prototype and POC goals

Draft 2 says the existing web app prototype and skin model are available, while development and validation of eye, ear, and dental screening plus urgency guidance remain things the 12-month POC must prove. The current source contains screening flows and consent-based referrals; that confirms the interface and workflow exist, not that the new models or field outcomes are clinically validated. The proposal targets a model prototype by month 6, real pilots with at least 3 clinics, at least 500 users by month 12, and partner growth from 17 to at least 25. The landing page labels these figures as goals, not completed results.

## Not claimed

Staff APIs and screens exist in source but are not listed in the current MVP navigation, so the landing page does not advertise team management. The sources reviewed do not establish a launched 24/7 veterinary service, clinical-grade accuracy, real-time partner revenue analytics, a free trial, or subscription pricing. The website does not promise these.

## Asset and implementation note

The app source contains UI and pet imagery but no verified production screenshots suitable for public marketing. The phone and portal displays are labeled sample interface concepts; pet names, appointment rows, and dates in those concepts are illustrative.


## Draft 2 facts added to the landing page

- FUFU provides free basic use with optional monthly plans; the proposal does not establish public-facing package prices, so none are shown.
- The proposed partner network includes clinics, pet shops, grooming shops, and pet hotels as Partner Portal members; membership willingness to pay is part of market validation.
- The proposal describes veterinarian-confirmed images, four urgency levels, clinic referral, and market testing as POC development or validation goals. The site does not present projected savings, projected revenue, or accuracy claims as achieved outcomes.
