const e=[{id:"c1",name:"Anna Müller",company:"Acme GmbH",email:"anna@acme.de",phone:"+49 170 1234567",source:"LinkedIn",notes:"Met at SaaStr EU. Interested in brand strategy.",last_contacted_at:"2026-04-20",created_at:17136e5},{id:"c2",name:"James Chen",company:"NovaTech",email:"james@novatech.io",phone:null,source:"Referral",notes:null,last_contacted_at:"2026-04-18",created_at:17135e5},{id:"c3",name:"Sophie Laurent",company:"Berliner Kreativ",email:"sophie@bk.studio",phone:"+49 30 9876543",source:"Conference",notes:"Needs website redesign Q3.",last_contacted_at:"2026-04-10",created_at:17134e5},{id:"c4",name:"Marcus Weber",company:"FinFlow AG",email:"m.weber@finflow.de",phone:null,source:"Cold outreach",notes:null,last_contacted_at:null,created_at:17133e5},{id:"c5",name:"Elena Rossi",company:"Scala Consulting",email:"elena@scala.it",phone:"+39 333 4567890",source:"LinkedIn",notes:"Italian market expansion project.",last_contacted_at:"2026-04-22",created_at:17132e5},{id:"c6",name:"Tom Harris",company:null,email:"tom@freelance.dev",phone:null,source:"GitHub",notes:"Freelance developer. Potential subcontractor.",last_contacted_at:"2026-03-15",created_at:17131e5}],t=[{id:"d1",name:"Acme Brand Strategy",contact_id:"c1",value:18e3,currency:"EUR",stage:"negotiation",notes:"Final pricing discussion Friday.",expected_close_date:"2026-05-01",created_at:17136e5,updated_at:171365e4},{id:"d2",name:"NovaTech Dashboard",contact_id:"c2",value:14500,currency:"EUR",stage:"proposal",notes:"Sent proposal v2.",expected_close_date:"2026-05-15",created_at:171355e4,updated_at:17136e5},{id:"d3",name:"BK Website Redesign",contact_id:"c3",value:22e3,currency:"EUR",stage:"prospect",notes:null,expected_close_date:"2026-06-01",created_at:17135e5,updated_at:17135e5},{id:"d4",name:"FinFlow Consulting",contact_id:"c4",value:8e3,currency:"EUR",stage:"prospect",notes:"Initial discovery call scheduled.",expected_close_date:null,created_at:171345e4,updated_at:171345e4},{id:"d5",name:"Scala Market Entry",contact_id:"c5",value:35e3,currency:"EUR",stage:"negotiation",notes:"Negotiating payment terms.",expected_close_date:"2026-05-10",created_at:17134e5,updated_at:171362e4},{id:"d6",name:"Acme Q1 Retainer",contact_id:"c1",value:12e3,currency:"EUR",stage:"won",notes:"Signed and invoiced.",expected_close_date:"2026-03-01",created_at:1712e6,updated_at:17125e5},{id:"d7",name:"NovaTech SEO Audit",contact_id:"c2",value:4500,currency:"EUR",stage:"won",notes:null,expected_close_date:"2026-03-15",created_at:17119e5,updated_at:17122e5},{id:"d8",name:"Harris Dev Sprint",contact_id:"c6",value:6e3,currency:"EUR",stage:"lost",notes:"Budget cut. Revisit in Q3.",expected_close_date:"2026-04-01",created_at:17118e5,updated_at:17121e5}],a=[{id:"a1",contact_id:"c1",deal_id:"d1",type:"meeting",description:"Scope review meeting — aligned on 3-phase approach",created_at:171365e4},{id:"a2",contact_id:"c1",deal_id:"d1",type:"email",description:"Sent revised pricing with volume discount",created_at:171364e4},{id:"a3",contact_id:"c2",deal_id:"d2",type:"email",description:"Sent proposal v2 with updated timeline",created_at:17136e5},{id:"a4",contact_id:"c5",deal_id:"d5",type:"call",description:"Discussed payment terms — NET 30 agreed",created_at:171362e4},{id:"a5",contact_id:"c3",deal_id:null,type:"note",description:"Sophie mentioned they're also looking for a content strategy partner",created_at:17135e5},{id:"a6",contact_id:"c1",deal_id:"d6",type:"task",description:"Send Q1 retainer invoice",created_at:17125e5},{id:"a7",contact_id:"c4",deal_id:"d4",type:"call",description:"Initial intro call — warm lead from FinTech meetup",created_at:171345e4},{id:"a8",contact_id:"c5",deal_id:"d5",type:"meeting",description:"Kickoff prep — reviewed Italian market research",created_at:171358e4},{id:"a9",contact_id:"c2",deal_id:"d7",type:"email",description:"Delivered SEO audit report",created_at:17122e5},{id:"a10",contact_id:"c6",deal_id:"d8",type:"email",description:"Follow-up after budget cut — offered Q3 restart",created_at:17121e5}],c=[{id:"p1",deal_id:"d2",version:2,status:"sent",created_at:17136e5,content:`# Dashboard Rebuild Proposal

## Executive Summary
We propose a complete rebuild of NovaTech's analytics dashboard, delivering a modern, performant interface that surfaces key metrics in real time.

## Scope of Work

### Phase 1: Discovery & Design (Weeks 1-2)
- Stakeholder interviews (3 sessions)
- Current dashboard audit
- Wireframes + interactive prototype

### Phase 2: Development (Weeks 3-6)
- React frontend with real-time data
- API integration layer
- Role-based access control

### Phase 3: Testing & Launch (Weeks 7-8)
- UAT with core team
- Performance optimization
- Deployment + monitoring setup

## Investment

| Phase | Deliverable | Fee |
|-------|-----------|-----|
| Phase 1 | Discovery & Design | €3,500 |
| Phase 2 | Development | €8,000 |
| Phase 3 | Testing & Launch | €3,000 |
| **Total** | | **€14,500** |

## Payment Terms
50% on signing, 25% at Phase 2 completion, 25% on launch.

## Timeline
8 weeks from kickoff. Target start: May 5, 2026.`}],n={contacts:e,deals:t,activities:a,proposals:c};export{n as MOCK_DATA};
