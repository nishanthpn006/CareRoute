# CareRoute — Product and System Specification

**Document:** Product requirements and architecture baseline  
**Version:** 1.1 (living working baseline; draft for review)  
**Date:** 16 October 2026  
**Initial pilot geography:** Tiruchirappalli, Tamil Nadu, India  
**Status:** Planning draft — not yet approved for clinical use or production deployment

> This document defines the product to design and build. It is not a clinical protocol, legal opinion, proof of hospital participation, or evidence of real-time bed data. Publicly displayed availability is only as trustworthy as the source and reporting process behind it.

## 1. Product summary

CareRoute is a public hospital discovery and reported bed-availability service. It helps patients and their families locate nearby hospitals based on a user-reported care need, a hospital's verified clinical capabilities, reported ward-level capacity, specialist coverage information, and estimated road travel time.

The first pilot is limited to Tiruchirappalli city and nearby district facilities as their records are verified. The architecture must support expansion to other districts without redesigning the core entities.

### Core user promise

Help people quickly find and contact a nearby hospital that appears suitable for their reported need, show how recently its capacity information was reported, and provide road directions and alternatives.

### Core limitation

CareRoute cannot guarantee that a hospital will admit a patient or that a reported bed remains free. It does not dispatch ambulances, reserve beds, diagnose a patient, or replace emergency medical services. Availability must always be labelled as reported, time-stamped, and subject to confirmation with the hospital.

### Living requirements and controlled changes

This specification is the current working baseline, not a feature freeze. During development, the owner may add, remove, or revise features. Before any material change, document the requested change, the problem it solves, affected workflows/data/API/security/test scope, risks, and impact on completed milestones. Update this document after approval and keep a brief change log. Do not silently build scope changes or claim a requirement is final when it remains open.

## 2. Product principles

1. **Emergency access first.** Emergency calling options remain visible and do not depend on login, location permission, or a completed search.
2. **Fit before proximity.** A hospital is not considered a suitable result merely because it is nearby or reports a free bed.
3. **Freshness is visible.** Facility verification and availability-report freshness are separate statuses.
4. **No invented live data.** Sample bed counts must be identified as demo data and must never be represented as production availability.
5. **Explainable matching.** Results use deterministic, documented rules and expose why a facility appears.
6. **Privacy by default.** The public finder does not require a patient account or persist a person's precise location for ordinary search.
7. **Least privilege.** A hospital user may manage only assigned facilities; platform verification and security administration are separate roles.
8. **Graceful failure.** If routing, location, or live updates fail, the service retains a usable hospital list and communicates uncertainty.
9. **Clinical review required.** Emergency-to-capability mappings and any red-flag guidance must be approved by qualified clinicians before use with real patients.
10. **Operational reality matters.** Production readiness requires participating hospitals or an authoritative availability data source, not just a deployed app.

## 3. Scope

### 3.1 Version 1 / pilot scope

- Public access without registration.
- Search hospitals by name, locality, city, address, specialty, or supported service.
- Manual location entry and optional browser geolocation.
- Map and list views with synchronized selection.
- Verified facility profiles with address, phone, operating/reporting status, specialties, services, equipment/capabilities, and approved specialist-coverage information.
- Availability by supported ward/bed category, including reported available count, total capacity, report timestamp, and freshness state.
- User-selected emergency/care categories mapped to clinician-reviewed capabilities.
- Route distance and estimated driving time when the routing provider returns a result.
- Deterministic ranking of suitable results, with alternatives and explicit stale/unknown status.
- Directions link and tap-to-call hospital contact action.
- Persistent SOS access for the regional 108 number and national 112 number, with clear labels and no claim that CareRoute dispatches a vehicle.
- Hospital onboarding and facility verification workflow.
- Authenticated hospital staff portal for authorized availability reports.
- Separate platform verification and security-administration functions.
- Audit trail for capacity changes and facility-publication changes.
- Basic reporting issue workflow for incorrect/outdated public information.
- Automated validation, security tests, CI checks, monitoring, and backup/recovery planning.

### 3.2 Out of scope for Version 1

- Diagnosis or automated clinical triage.
- AI-generated severity scores.
- Bed reservation, admission, payment, telemedicine, or ambulance dispatch.
- Patient profiles, medical histories, prescriptions, ABHA integration, or patient records.
- Claims that every hospital in the district participates.
- Publicly exposing private doctor schedules or personal contact information without authorization.
- A promise of live data unless the facility reporting process or approved integration supports it.

## 4. User roles and permissions

### 4.1 Public user

- Browse published facility details and capability information.
- Search and filter by care category, specialty, services, bed category, geography, availability freshness, and route estimate.
- See the source/freshness of availability data.
- Open directions and call a hospital.
- Report a possibly incorrect listing using a bounded issue form.
- Use emergency call links without signing in.
- Cannot create, modify, or publish facility or availability records.

### 4.2 Hospital organization administrator

- Belongs to a verified hospital organization.
- May manage approved facilities assigned to their organization.
- May invite or request access for staff, subject to approval policy.
- May submit, correct, and review availability reports.
- May view audit history for their own facilities.
- Cannot approve their own facility verification if separation of duties is required by the pilot policy.
- Cannot read another organization's private records or change its facilities by altering a request ID.

### 4.3 Facility manager / reporter

- May update only explicitly assigned facility records and bed categories.
- May submit capacity reports and specialist-coverage changes if granted that permission.
- Cannot change organization ownership, platform roles, verification status, or security settings.

### 4.4 Platform verifier / operations staff

- Reviews registration evidence and facility details.
- Approves, rejects, suspends, or schedules reverification for a listing.
- Reviews stale or disputed availability information.
- Cannot bypass audit logging.

### 4.5 Security administrator

- Manages platform-level role assignments and emergency account suspension.
- Uses strong authentication and MFA where available.
- Is not automatically permitted to edit clinical capacity without an explicit operational role.

## 5. Main user workflows

### 5.1 Public finder

1. User opens CareRoute; no account is required.
2. User allows optional geolocation or enters a locality/address manually.
3. User selects a reported situation/care category, or chooses a specialty/service directly.
4. User optionally selects a bed category or capability requirement if known; the app must not force a non-clinician to make an uncertain medical decision.
5. The system derives required capabilities from a reviewed, versioned mapping.
6. The system queries published, active, verified facilities and checks whether capability and relevant availability reports meet the matching policy.
7. The system computes driving distance/time for a shortlist, where route calculation is available.
8. The map and list show suitable results, reasons for matching, relevant bed counts, timestamps, route estimates, phone, and directions.
9. If no fresh matching result exists, the app says so plainly and can show nearby appropriate facilities with availability marked unconfirmed. It must not say that no beds exist merely because no current report is present.
10. The user calls the facility or opens directions and is prompted to confirm availability directly.

### 5.2 Hospital onboarding and verification

1. A representative submits the organization and facility profile.
2. The platform verifier checks identity, address, relevant registration/license references where applicable, facility contact, and authority of the representative.
3. Verification evidence is stored privately and never included in public responses.
4. The organization is approved, rejected, or returned for clarification.
5. Authorized users are assigned to the organization and specific facilities.
6. Capabilities and specialty coverage are entered and verified separately from the general hospital profile.
7. The facility becomes public only after the required identity/profile checks are passed. Capacity may remain "not yet reported" until an accepted report exists.

### 5.3 Availability report

1. Authorized staff selects a facility and a supported bed category.
2. Staff enters total capacity and reported available-to-admit beds, plus any additional fields required by the agreed reporting policy.
3. Backend verifies identity, assigned facility permissions, value ranges, report version/idempotency, and consistency.
4. Accepted report is saved as immutable history, and the latest accepted snapshot is atomically updated.
5. Audit event records actor, facility, category, report time, source, outcome, and changed values.
6. The public projection is updated, and subscribed clients are notified if real-time streaming is enabled.
7. If the report passes its configured freshness window, the public state changes to overdue/stale/unknown without pretending the bed count is current.

### 5.4 Incorrect information report

1. Public user selects a facility and issue category (e.g. phone number incorrect, facility closed, availability appears outdated).
2. The form collects only information needed to investigate; it must not invite patient medical records or unnecessary sensitive free text.
3. Operations reviews and resolves the issue, with an audit event.
4. If a safety-critical facility or capacity issue is confirmed, that listing or capacity snapshot can be suspended pending verification.

## 6. Functional requirements

Priority levels: P0 = mandatory for a controlled pilot; P1 = useful follow-up. A safety/security defect that blocks safe launch is P0 regardless of the original label.

| ID | Requirement | Priority | Acceptance summary |
|---|---|---|---|
| FR-01 | Public hospital directory | P0 | Published records are available without patient login; private fields are omitted. |
| FR-02 | Manual location | P0 | Finder works when GPS is denied or unavailable. |
| FR-03 | Optional device location | P0 | Permission is explicit; precise location is not persisted by default. |
| FR-04 | Search and filters | P0 | Name, locality, capability, specialty, bed category, and availability freshness filters behave correctly. |
| FR-05 | Map/list views | P0 | Markers and list selection stay synchronized; map failure does not disable the list. |
| FR-06 | Road routing | P0 | Display provider-returned road distance and ETA where available; clearly label estimates. |
| FR-07 | Routing fallback | P0 | If route lookup fails, show no fabricated ETA and optionally show straight-line distance as an approximation. |
| FR-08 | Emergency/care category selection | P0 | Each category maps to a versioned, clinician-reviewed capability mapping before real-patient use. |
| FR-09 | Facility verification state | P0 | Pending/rejected/suspended facilities are not shown as verified/public matches. |
| FR-10 | Capability catalogue | P0 | Facilities show only capabilities that have been verified and not expired. |
| FR-11 | Specialist coverage | P0 | Coverage status and validity times are shown separately from a general doctor directory. |
| FR-12 | Bed-category availability | P0 | Each bed category has a defined count meaning, report source, and timestamp. |
| FR-13 | Availability freshness | P0 | Old/missing reports are labelled and excluded from fresh-match claims. |
| FR-14 | Hospital staff authentication | P0 | Write actions require authenticated, active users. |
| FR-15 | Facility-scoped authorization | P0 | Requests cannot mutate other organizations' facilities by changing IDs or payload fields. |
| FR-16 | Availability report validation | P0 | Reject negative/non-integer counts, unavailable categories, inconsistent values, and duplicate/replayed submissions as defined by contract. |
| FR-17 | Availability history and audit | P0 | Accepted and rejected writes leave appropriate audit records; corrections are traceable. |
| FR-18 | SOS call actions | P0 | Call links are visible without login/location; app makes no claim of dispatch. Regional numbers are verified before launch. |
| FR-19 | Empty/stale/failure states | P0 | UI explains what is unknown and provides safe next steps and alternatives. |
| FR-20 | Accessibility and mobile usability | P0 | Core tasks are keyboard accessible and usable on narrow screens; status is not communicated by color alone. |
| FR-21 | Issue reports | P1 | Users can report incorrect public information; ops can track resolution. |
| FR-22 | Reminder/overdue notification | P1 | Staff can be prompted to refresh overdue reports, subject to a verified contact channel. |
| FR-23 | External capacity feeds | P1 | Integrations can be added only after source access, schema, legal terms, ownership and service reliability are confirmed. |

## 7. Clinical capability model and deterministic matching

### 7.1 User-facing care categories

Initial proposed categories, to be reviewed by clinicians:

- Major accident / trauma.
- Cardiac emergency.
- Possible stroke.
- Severe breathing difficulty.
- Paediatric emergency.
- Pregnancy-related emergency.
- Other / not sure.

These are user-reported categories, not diagnoses. Avoid a long questionnaire. If a case may be immediately life-threatening, emergency assistance guidance is shown immediately and is never blocked by search completion, login, GPS, or form completion.

### 7.2 Capability dimensions

Use explicit, maintained capability values instead of assumptions based on hospital name:

- Emergency/trauma care.
- Emergency surgery and relevant surgical coverage.
- Cardiology and cardiac intervention capabilities where offered.
- Neurology, stroke assessment and neuro-related capabilities where offered.
- General ICU and HDU.
- Paediatric emergency, PICU and NICU as appropriate.
- Obstetric/maternity emergency capability.
- Imaging and diagnostic services such as CT, MRI, X-ray, and laboratory services where relevant.
- Blood bank/transfusion services where confirmed.
- Oxygen and ventilator-supported capacity, modeled separately from physical bed totals.

The final catalogue and emergency-to-capability mappings require qualified clinical review. Do not treat this illustrative list as an approved medical protocol.

### 7.3 Specialist information

Separate:

- `specialtiesOffered`: the hospital normally offers this specialty.
- `specialistCoverage`: a specific time-bounded coverage report such as onsite, on-call, unavailable, or unknown.
- Optional public clinician profile: shown only when the hospital has authorized publication and the individual details are appropriately approved.

A hospital's list of employed doctors does not prove that a specialist is on duty right now. Public results should say "coverage reported" and show `lastUpdatedAt` where applicable. Do not expose private contact numbers or personal schedules.

### 7.4 Matching and ranking policy

Eligibility checks (in order):

1. Facility is published, active, and currently verified under the pilot policy.
2. Required care capabilities are verified and available according to a valid coverage report when time-bound coverage is necessary.
3. If a known bed category is required, a fresh accepted report for that category meets the availability criteria.
4. Availability data meets the configured freshness policy for a "fresh match" label.
5. Route estimate is computed where possible.

Ranking among suitable fresh results:

1. Estimated driving time (ascending), when the same routing mode/provider can compare results.
2. If driving-time calculation is unavailable, approximate geographic distance as a clearly labelled fallback.
3. Use capability match specificity and report freshness as transparent secondary considerations where needed.

Do not mix route times from incompatible routing modes without disclosure. Do not present an old report as available just because it is the nearest. If no fresh matching facility exists, show a clear message and a separate group of appropriate nearby alternatives with availability unconfirmed. Never claim the system knows that all beds are full when reports are missing.

The exact fallback ranking order and freshness windows are operational policy decisions that must be approved before launch.

## 8. Bed availability and freshness policy

### 8.1 Data semantics

For every bed category, record:

- `totalBeds`: reported total capacity for the category.
- `availableBeds`: reported beds currently available to accept a suitable patient under the facility's agreed definition.
- Optional `occupiedBeds` and `unavailableBeds`, only if the hospital can report these consistently.
- `reportedAt`, `receivedAt`, `reportedBy`, `sourceType`, and `reportStatus`.

Do not assume categories are additive. ICU beds with oxygen support or ventilator capability are overlapping characteristics, not independent capacity that can be added to general/ICU totals. Oxygen and ventilator capacity should be represented as separate resources/capabilities with their own definitions.

Validation must at least require non-negative integer counts and `availableBeds <= totalBeds`. If occupied/unavailable counts are also required, the reporting contract must define the exact consistency constraints. Agree these definitions with each participating hospital before accepting production reports.

### 8.2 Freshness states

Suggested initial configurable states (provisional values for pilot testing, not a medical standard):

- `FRESH`: report age <= 15 minutes.
- `OVERDUE`: report age > 15 and <= 60 minutes.
- `STALE`: report age > 60 minutes; not eligible for a confirmed-current match.
- `UNKNOWN`: no accepted report exists or data integrity/source status is unresolved.

The pilot must validate the reporting cadence with hospital operations staff. A report timestamp proves when data was submitted, not that all counts were independently checked. Every public count must include its report time and status. Facility-profile verification and capacity-report freshness must remain independent.

### 8.3 Atomic update behavior

A report must be validated before publication. Save the immutable report history and latest accepted projection as a consistent operation (transaction/batch where supported). If any required write fails, the public latest snapshot must not become partially updated. Corrections should reference the earlier report when possible.

## 9. Logical data model

This is a logical design; exact Firestore collection/document shape follows after access patterns, volume, and security rules are validated.

### 9.1 `organizations`

- `organizationId`
- `legalName`, `displayName`, `organizationType`
- `status` (pending/active/suspended/closed)
- verified public contact details
- `createdAt`, `updatedAt`
- private verification metadata kept separately

### 9.2 `facilities`

- `facilityId`, `organizationId`
- official/display names and aliases
- facility type (district hospital, taluk hospital, private hospital, clinic, etc.)
- address components, locality, district, state, postal code
- latitude/longitude and geocode provenance/checked timestamp
- public telephone number and approved contact channel
- operating/reporting status
- `verificationStatus` (pending/verified/rejected/suspended/reverification-due)
- `publicationStatus` (draft/published/hidden)
- `verifiedAt`, `verificationDueAt`, `sourceReference`, `lastProfileCheckedAt`
- public website and directions/map reference where available
- timestamps

### 9.3 `facilityCapabilities`

- `facilityId`, canonical capability ID
- status (available/temporarily unavailable/unknown)
- source, verifier, `verifiedAt`, `validUntil`, `lastUpdatedAt`
- optional operating hours or restrictions

### 9.4 `specialistCoverage`

- `coverageId`, `facilityId`, specialty ID
- coverage state (onsite/on-call/unavailable/unknown)
- `coverageStartAt`, `coverageEndAt`, `reportedAt`, `verifiedAt`
- source and authorized reporting user
- optional clinician profile reference and public-display consent/approval state
- no private personal phone or private schedule in the public projection

### 9.5 `availabilityReports` (append-only history)

- `reportId`, `facilityId`, bed category ID
- `totalBeds`, `availableBeds`, optional consistent occupied/unavailable counts
- `reportedAt`, server `receivedAt`, `validUntil`
- `reportedByUid`, role/facility membership reference
- source type (authorized manual report or approved data integration)
- status (accepted/rejected/superseded/withdrawn)
- validation outcome/reason, `correctionOfReportId`, request/idempotency reference

### 9.6 `availabilityCurrent`

- key/reference identifying one facility + one bed category
- latest accepted report reference
- latest available/total values
- report/receive timestamps, freshness state, operational status
- version number for conflict detection

### 9.7 `users` / organization memberships

- Firebase UID
- active/disabled status
- role (facility reporter, organization admin, platform verifier, security admin)
- organization ID and explicitly assigned facility IDs/permissions
- created/updated timestamps
- identity provider holds authentication credentials; don't store plaintext passwords

### 9.8 `verificationCases`

- facility/organization reference
- verification steps and statuses
- source references and private evidence storage references
- reviewer UID, decision, reason code, timestamps, review expiry
- private access only

### 9.9 `auditEvents`

- actor UID and role at time of action
- action, target type/ID, time, outcome
- old/new values or safely redacted diff for relevant fields
- request/correlation ID and reason code
- append-only permission model and retention policy

### 9.10 `publicDirectory` (read-only public projection)

- only verified/public facility name, address, coordinates, public phone, verified public specialties/capabilities, service state, approved public specialist coverage, and latest availability summary/freshness
- no verification evidence, personal information, staff memberships, private contact data, internal comments, access tokens, or private audit data
- anonymous access should be read-only; writes happen through trusted server-side publication logic

### 9.11 `issueReports`

- facility ID, category, submitted timestamp
- bounded description, optional evidence only when necessary
- review state, assigned reviewer, resolution code and timestamps
- minimize personal data; do not invite patient medical records

### 9.12 Versioned capability catalogue and care-need mapping

- canonical category/capability IDs and definitions
- mapping version, author/reviewer, clinical approval state and effective dates
- requirements and exclusions for each user-reported care category
- change history and effective date

## 10. API and data-flow boundaries

Initial API contract categories (exact request/response schema to be written separately):

### Public read endpoints

- `GET /api/public/facilities` — searchable, filtered published-directory results.
- `GET /api/public/facilities/:facilityId` — public facility profile and approved capability/availability summary.
- `GET /api/public/care-categories` — allowed user-facing categories and public explanatory labels.
- `GET /api/public/route-estimates` — server-mediated route estimate for a bounded shortlist; validates origins/destinations, rate-limits requests, and does not expose a privileged maps key.

### Authenticated staff endpoints

- `GET /api/staff/facilities` — facilities assigned to the user.
- `POST /api/staff/facilities/:facilityId/availability-reports` — submit report.
- `GET /api/staff/facilities/:facilityId/availability-reports` — view own-facility report history, according to role.
- `POST /api/staff/facilities/:facilityId/capabilities` — request/update capability information subject to verification workflow.
- `POST /api/staff/facilities/:facilityId/specialist-coverage` — update coverage if authorized.

### Platform operations endpoints

- Organization/facility onboarding and verification decisions.
- Suspend/reinstate listing and resolve issue reports.
- User membership and permissions management.
- Audit review and data-quality monitoring.

All write endpoints must validate the Firebase ID token, active user state, organization membership, facility assignment, role, payload, and permitted state transition. Do not trust a role, `organizationId`, or `facilityId` from the client payload without checking it against the authenticated identity and stored membership.

## 11. Proposed technical architecture

### Frontend

- React + Vite; responsive, mobile-first UI.
- Main public areas: Map, Nearby Hospitals, Find Care. SOS action is visible across all areas.
- Hospital administrator portal separated from the public finder.
- Map and routing provider adapter so the routing provider can be replaced without changing matching logic.
- Browser geolocation used only after explicit permission; manual location always available.

### Backend

- Node.js + Express.
- Public read and route estimate APIs separated from staff/admin write APIs.
- Validation, access control, capability matching, freshness policy, audit logging, and provider key protection on the server.
- API-level rate limits, bounded route calculations, timeouts, clear error responses and privacy-conscious logs.

### Identity and storage

- Firebase Authentication for authorized staff.
- Cloud Firestore for private operational records, append-only reports, current snapshots and public directory projection.
- Client-side Firestore access limited to the explicit public projection (or alternatively served through a public API if this simpler policy is safer).
- Administrative operations use the Express API with Firebase Admin SDK.
- Important: Firebase Admin/server SDKs bypass Cloud Firestore Security Rules. Every server-side API operation must enforce authorization itself, and server IAM/service-account privileges must be minimized and monitored.

### Realtime updates

- Prefer Firestore listeners on the small, public `publicDirectory` projection if limits and privacy review support this pattern.
- Otherwise use short polling initially. Polling every 15 seconds is near-real-time UI refresh, not a push guarantee.
- Public changes must only publish after validation and acceptance of a report.

### Mapping and routing

- Evaluate Google Maps Platform as the provisional provider for map display and route matrix distance/duration.
- Use a browser-restricted map key only for browser map functionality and a separate server-side restricted key for privileged route requests; never expose a server key in `VITE_*` variables or client bundles.
- Compute driving routes only for the shortlist of suitable facilities to control cost and latency.
- Provide routes/directions links even if in-app route calculation fails.
- Recheck provider terms, billing, per-SKU caps, usage controls and expected spend before production.

### Hosting

- Provisional: frontend on Firebase Hosting or another static host; Express API on Cloud Run; Firestore/Auth in Firebase/Google Cloud.
- Final hosting depends on operational cost, reliability, data region, monitoring, backup, API-key management, and the team's ability to maintain it.

## 12. Ranking and routing behavior

- Filter for the required verified capabilities first.
- Determine whether the relevant bed report exists and whether it is within the configurable freshness policy.
- Calculate provider-returned driving time/distance for a bounded shortlist of eligible facilities.
- Sort fresh suitable results by driving time ascending by default; show distance alongside time.
- If no route estimate is available, do not invent an ETA. Optionally fall back to straight-line distance labelled as an approximation.
- Keep stale/unknown availability out of the "freshly reported available" set; it may appear in a separate alternative list with an explicit warning.
- If no fresh suitable facility is found, state that no current matching report was found, not that no beds exist.
- Explain match reasons (e.g. required trauma capability reported, ICU report received at a timestamp, estimated drive time).
- An ETA is a routing estimate, not an ambulance response time, guarantee, or clinical recommendation.

## 13. SOS and emergency guidance

- Keep SOS/call options visible on mobile and desktop public pages.
- Keep the SOS destination configurable rather than embedding a number directly in a UI component. During local testing, use a clearly identified test contact configured outside source code; never label it as a real emergency service.
- For the Tiruchirappalli pilot, configure the intended regional 108 and national 112 calling options only after checking labels and behavior against official sources again before launch.
- Use phone-call links such as `tel:`; on unsupported devices, show the configured number and copying instructions.
- Do not require GPS, a login, a case questionnaire, or a bed search before dialing.
- Do not claim that CareRoute notifies dispatch, transmits caller location to emergency services, tracks an ambulance, or has booked transport unless a separately approved and technically integrated service genuinely does so.
- If a clinician-reviewed red-flag rule set is later approved, it must never delay SOS access or offer reassurance that overrides emergency guidance.

## 14. Privacy and security requirements

- No patient account or patient medical-history collection in Version 1.
- Do not persist the user's precise search location by default; minimize or redact location information from server logs.
- Publish only approved facility fields in the public projection.
- Keep registration evidence, staff data, audit notes and authentication metadata private.
- Protect credentials and API keys through environment variables/secret management; never commit `.env`, service-account JSON, tokens, or private keys.
- Enforce hospital/facility-level authorization server-side and test direct-ID/IDOR attempts.
- Use strong staff authentication, MFA where available, token validation, request size limits, rate limits and secure HTTP headers.
- Add abuse monitoring for fake facility registration and capacity updates.
- Establish data minimization, purpose notices, correction/erasure request handling where applicable, retention schedules, incident response and vendor/third-party data terms.
- Obtain legal review of applicable Indian privacy rules and Tamil Nadu-specific healthcare establishment/registration requirements before live operation. The applicable DPDP rules have a phased commencement schedule; confirm the provisions in force at actual launch rather than assume every provision commenced on publication.
- This is a technical planning baseline, not legal advice or a substitute for a privacy/security review.

## 15. Reliability and operational controls

- Explicit reporting responsibility and cadence for every participating hospital.
- Configurable freshness windows and alerting when a report becomes overdue.
- A contact/verification process when counts appear inconsistent or an issue is reported.
- Suspend public availability claims if the source or facility is under investigation.
- Backup and recovery plan for private records and audit logs.
- Health checks, error tracking, latency and uptime monitoring, and route API usage/cost monitoring.
- Idempotency/concurrency controls for repeated or simultaneous updates.
- Data migration/versioning plan for category and schema changes.
- Accessibility and low-bandwidth mobile behavior.

## 16. Acceptance tests and release gates

The pilot cannot be considered ready until the following have been verified:

1. Public finder is usable without login or GPS permission.
2. All listed facilities have source provenance and honest verification status.
3. No demo availability is shown as real data.
4. Search/filter logic has tests for missing, stale, zero, invalid, and contradictory capacity reports.
5. Emergency-care mapping is reviewed and signed off by qualified clinicians.
6. A hospital staff user can update only assigned facilities; attempts to modify another facility receive an authorization failure.
7. Invalid bed counts and unsupported bed categories are rejected without corrupting the current snapshot.
8. Audit records identify report source, actor, and time.
9. Freshness transition and stale-data UI have tests (including no report, overdue report, and route failure).
10. Routing failures never produce a made-up distance or travel time.
11. 108/112 call actions do not require login/location and do not claim dispatch.
12. Public projection excludes private verification documents, staff personal details, and audit records.
13. Firestore rules and server IAM/authorization are tested; do not assume Firestore rules protect Admin SDK calls.
14. Automated server and client tests, production build, security checks, and mobile/accessibility checks pass.
15. Participating hospitals and reporting contacts are confirmed before real bed counts are displayed as operational data.
16. Legal, privacy, incident, support, and data-correction processes are approved before public launch.

## 17. Implementation milestones

### M0 — Requirements and source-data discovery

- Approve this specification and the data dictionary.
- Define exact pilot boundary and target facility types.
- Establish whether hospital participation, direct reporting or an approved data integration is available.
- Define clinician review/approval owner for capability mappings and emergency guidance.
- Confirm route provider, expected traffic and cost controls.

**Gate:** no unresolved question about data provenance, reporting ownership, or claim wording that would make public availability misleading.

### M1 — Repository and environment baseline

- Review the existing starter source and preserve useful work.
- Fix known bugs, complete tests, align CI, and remove unsafe default secrets.
- Set up development/emulator environments and secret handling.

**Gate:** clean reproducible installs, tests and builds; no secrets tracked.

### M2 — Data schema and authorization foundation

- Implement logical entities, Firestore access patterns and migration/versioning conventions.
- Implement user/org/facility membership checks, public projection rules, audit patterns and automated security tests.

**Gate:** cross-hospital unauthorized writes and private-data reads are denied in tests.

### M3 — Verified hospital directory

- Import candidate directory metadata with source and checked timestamp.
- Review duplicate locations, coordinates, addresses and phones.
- Build publication/verification workflows and map/list search.

**Gate:** only approved facilities are labelled verified; uncertain fields are labelled unknown.

### M4 — Clinical capability and coverage model

- Create the canonical specialty/capability dictionary.
- Add the reviewed emergency-to-capability mappings and time-bound specialist coverage.
- Design public labels that distinguish a hospital's usual specialty from current coverage.

**Gate:** clinician review and facility-level verification completed for pilot listings.

### M5 — Availability reporting and audit

- Build staff dashboard updates, validated reports, immutable history and current snapshots.
- Add freshness lifecycle and issue reporting.

**Gate:** end-to-end report/update tests pass and stale reports cannot look confirmed.

### M6 — Matching, map and road routing

- Apply deterministic eligibility rules, calculate route estimates for a shortlist, rank by estimated driving time and show distance.
- Add failure and fallback states, directions and call actions.

**Gate:** matching and route estimates are tested against normal, stale, missing, no-route and no-match scenarios.

### M7 — Safety, accessibility and pilot readiness

- Complete security, privacy, accessibility, mobile, load, monitoring, backup and incident tests.
- Confirm 108/112 behavior, support contacts and correction process.

**Gate:** zero unresolved critical security/safety issues and signed-off operational procedures.

### M8 — Controlled pilot and expansion

- Start only with facilities that actively agreed to participate and assigned update owners.
- Monitor report freshness, availability discrepancies, route performance and support needs.
- Expand geography only after coverage and data quality criteria are met.

**Gate:** real-world reporting and support performance meet explicitly agreed thresholds.

## 18. Open decisions before coding further

1. **Data reporting model:** direct hospital staff entry, a formal health-authority feed, or both. Do not assume a government feed exists until access has been confirmed.
2. **Freshness policy:** the 15-minute/60-minute values above are provisional and must be agreed with hospital operations staff.
3. **Bed categories:** confirm the first supported categories and exact definition of "available to accept a patient" with pilot hospitals.
4. **Specialist data:** decide when only specialty coverage is shown versus named doctor profiles. Default to minimal public personal data.
5. **Clinical mapping approval:** identify qualified clinician(s) and review process for capability mapping and any red-flag guidance.
6. **Mapping provider:** compare Google Maps Platform with alternatives after checking terms, regional behavior, key restrictions, quotas and costs.
7. **Pilot boundary:** define whether the initial public service covers Trichy city only or a larger district area, based on verified participating facilities rather than arbitrary coverage claims.
8. **Verification policy:** identify acceptable evidence and renewal frequency for each facility type.
9. **Operational owner:** identify who will investigate stale, disputed, or incorrect information once a pilot is live.
10. **Legal/privacy review:** confirm requirements applicable to the specific organization and launch model.

## 19. Initial source references

These references establish the starting point for planning, not evidence of live capacity feeds:

- Tiruchirappalli District official hospital directory: https://tiruchirappalli.nic.in/public-utility-category/hospitals/
- Tiruchirappalli District official helpline directory: https://tiruchirappalli.nic.in/helpline/
- India Emergency Response Support System (112): https://112.gov.in/about
- Google Maps Platform India pricing: https://developers.google.com/maps/billing-and-pricing/pricing-india
- Google Routes API route matrix documentation: https://developers.google.com/maps/documentation/routes/compute_route_matrix
- Firebase Firestore security guidance: https://firebase.google.com/docs/firestore/security/insecure-rules
- MeitY DPDP Rules 2025 and commencement timeline: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa
- Ministry of Health and Family Welfare Clinical Establishments Act information: https://www.clinicalestablishments.mohfw.gov.in/faq

---

**Review status:** Draft baseline prepared. No application source code was changed while authoring this specification. The document must be reviewed with the project owner and, where required, clinicians, participating hospitals, security/privacy reviewers, and qualified legal advisers before production implementation or real-patient use.


## 17. Working agreement and change log

- Keep this specification as the single source of truth for the product requirements agreed so far.
- The owner may add/remove/revise features as the project develops. Discuss material changes briefly, assess impacts, then update this document and tests before implementation.
- Do not create a remote GitHub repository, commit, or push without the owner's explicit instruction after reviewing the local changes.
- As of 16 October 2026, the existing starter has had a Milestone 1 implementation reported by Antigravity. Reported tests/build have not been independently re-run in this specification workflow.
- v1.1: Clarified the specification is a living baseline and SOS test contacts must be configurable and clearly distinguished from real emergency numbers.
