const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'bufs2025!';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'responses.json');

// JSON DB 초기화
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return []; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic Auth 미들웨어
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('관리자 인증이 필요합니다.');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"');
  return res.status(401).send('아이디 또는 비밀번호가 올바르지 않습니다.');
}

// 설문 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'survey.html'));
});

// 제출 처리
app.post('/submit', (req, res) => {
  const b = req.body;
  const arr = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

  const responses = readDB();
  const newEntry = {
    id: responses.length + 1,
    submitted_at: new Date().toISOString(),
    gender: b.gender || '',
    age_group: b.age_group || '',
    org_type: b.org_type || '',
    org_type_other: b.org_type_other || '',
    job: b.job || '',
    job_other: b.job_other || '',
    career: b.career || '',
    ai_importance: b.ai_importance || '',
    ai_fields: arr(b['ai_fields[]']),
    future_ai_fields: arr(b['future_ai_fields[]']),
    non_major_necessity: b.non_major_necessity || '',
    talent_type: b.talent_type || '',
    talent_type_other: b.talent_type_other || '',
    lk1: b.lk1||'', lk2: b.lk2||'', lk3: b.lk3||'', lk4: b.lk4||'',
    lk5: b.lk5||'', lk6: b.lk6||'', lk7: b.lk7||'', lk8: b.lk8||'',
    lk9: b.lk9||'', lk10: b.lk10||'', lk11: b.lk11||'',
    edu_methods: arr(b['edu_methods[]']),
    non_major_factor: b.non_major_factor || '',
    non_major_factor_other: b.non_major_factor_other || '',
    industry_fields: arr(b['industry_fields[]']),
    employment_competitiveness: b.employment_competitiveness || '',
    career_fields: arr(b['career_fields[]']),
    improvement: b.improvement || '',
    improvement_other: b.improvement_other || '',
    opinion_differentiation: b.opinion_differentiation || '',
    opinion_core_competency: b.opinion_core_competency || '',
    opinion_additional: b.opinion_additional || ''
  };

  responses.push(newEntry);
  writeDB(responses);

  res.send(`<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>제출 완료</title>
<style>
  body{font-family:'Malgun Gothic',sans-serif;background:#f5f7fa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:white;border-radius:16px;padding:60px 50px;text-align:center;max-width:480px;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
  h1{color:#1a3a6b;font-size:24px;margin-bottom:12px}
  p{color:#5a6577;line-height:1.8;margin-bottom:28px}
  .badge{background:#eef2f8;color:#1a3a6b;padding:10px 20px;border-radius:8px;font-size:13px}
  .checkmark{font-size:56px;margin-bottom:20px}
</style></head>
<body>
<div class="card">
  <div class="checkmark">✅</div>
  <h1>설문 응답이 완료되었습니다.</h1>
  <p>소중한 의견 주셔서 감사합니다.<br>귀하의 의견은 부산외국어대학교<br>AI 융합교육과정 개발에 활용될 예정입니다.</p>
  <div class="badge">부산외국어대학교 · 첨단산업 인재양성 부트캠프 사업단</div>
</div>
</body></html>`);
});

// 관리자 페이지
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 응답 데이터 API (admin 페이지에서만 호출되므로 별도 인증 불필요)
app.get('/api/responses', (req, res) => {
  const responses = readDB();
  res.json({ total: responses.length, responses: responses.slice().reverse() });
});

// 통계 API
app.get('/api/stats', (req, res) => {
  const responses = readDB();
  const group = (field) => {
    const map = {};
    responses.forEach(r => { const v = r[field]||'미응답'; map[v] = (map[v]||0)+1; });
    return Object.entries(map).map(([k,v]) => ({[field]:k, count:v}));
  };
  res.json({
    total: responses.length,
    byGender: group('gender'),
    byAge: group('age_group'),
    byOrg: group('org_type'),
    byCareer: group('career'),
    byAiImportance: group('ai_importance')
  });
});

// CSV 내보내기
app.get('/api/export', (req, res) => {
  const responses = readDB();
  if (!responses.length) return res.status(404).send('데이터 없음');

  const headers = Object.keys(responses[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...responses.map(r => headers.map(h => escape(r[h])).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="survey_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('﻿' + csv);
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin`);
  console.log(`관리자 계정: ${ADMIN_USER} / ${ADMIN_PASS}`);
});
