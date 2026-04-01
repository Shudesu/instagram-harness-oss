(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))a(o);new MutationObserver(o=>{for(const r of o)if(r.type==="childList")for(const i of r.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function n(o){const r={};return o.integrity&&(r.integrity=o.integrity),o.referrerPolicy&&(r.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?r.credentials="include":o.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function a(o){if(o.ep)return;o.ep=!0;const r=n(o);fetch(o.href,r)}})();const k={},w=(k==null?void 0:k.VITE_CALENDAR_CONNECTION_ID)||"",c={currentYear:new Date().getFullYear(),currentMonth:new Date().getMonth(),selectedDate:null,slots:[],selectedSlot:null,profile:null,friendId:null,loading:!1,submitting:!1};function C(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function S(e,t){return fetch(e,{...t,headers:{"Content-Type":"application/json",...t==null?void 0:t.headers}})}function h(e){const t=new Date(e);return`${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`}function y(e){const t=new Date(e+"T00:00:00"),n=["日","月","火","水","木","金","土"];return`${t.getFullYear()}年${t.getMonth()+1}月${t.getDate()}日(${n[t.getDay()]})`}function b(){return document.getElementById("app")}function U(e,t){return new Date(e,t+1,0).getDate()}function B(e,t){return new Date(e,t,1).getDay()}function P(e,t,n){const a=new Date;return a.getFullYear()===e&&a.getMonth()===t&&a.getDate()===n}function q(e,t,n){const a=new Date,o=new Date(e,t,n);return a.setHours(0,0,0,0),o<a}function H(e,t,n){return`${e}-${String(t+1).padStart(2,"0")}-${String(n).padStart(2,"0")}`}function j(){const{currentYear:e,currentMonth:t,selectedDate:n}=c,a=U(e,t),o=B(e,t),r=["日","月","火","水","木","金","土"];let i=`
    <div class="booking-calendar">
      <div class="calendar-header">
        <button class="cal-nav" data-action="prev-month">&lt;</button>
        <span class="cal-title">${e}年${t+1}月</span>
        <button class="cal-nav" data-action="next-month">&gt;</button>
      </div>
      <div class="cal-weekdays">
        ${r.map((s,d)=>`<span class="${d===0?"sun":d===6?"sat":""}">${s}</span>`).join("")}
      </div>
      <div class="cal-days">
  `;for(let s=0;s<o;s++)i+='<span class="cal-day empty"></span>';for(let s=1;s<=a;s++){const d=H(e,t,s),u=q(e,t,s),E=P(e,t,s),O=["cal-day",u?"past":"active",E?"today":"",n===d?"selected":"",new Date(e,t,s).getDay()===0?"sun":"",new Date(e,t,s).getDay()===6?"sat":""].filter(Boolean).join(" ");i+=`<span class="${O}" ${u?"":`data-date="${d}"`}>${s}</span>`}return i+="</div></div>",i}function z(){const{slots:e,selectedDate:t,selectedSlot:n,loading:a}=c;if(!t)return"";if(a)return`
      <div class="slots-section">
        <h3>${y(t)}</h3>
        <div class="slots-loading">
          <div class="loading-spinner"></div>
          <p>空き状況を確認中...</p>
        </div>
      </div>
    `;if(e.length===0)return`
      <div class="slots-section">
        <h3>${y(t)}</h3>
        <p class="no-slots">この日は予約枠がありません</p>
      </div>
    `;const o=e.map(r=>{const i=(n==null?void 0:n.startAt)===r.startAt;return`<button class="${r.available?i?"slot-btn selected":"slot-btn available":"slot-btn full"}" ${r.available?`data-start="${r.startAt}" data-end="${r.endAt}"`:"disabled"}>${h(r.startAt)} - ${h(r.endAt)}</button>`}).join("");return`
    <div class="slots-section">
      <h3>${y(t)}</h3>
      <div class="slots-grid">${o}</div>
    </div>
  `}function R(){const{selectedSlot:e,selectedDate:t,profile:n}=c;return!e||!t?"":`
    <div class="confirm-section">
      <div class="confirm-card">
        <h3>予約内容の確認</h3>
        <div class="confirm-details">
          <div class="confirm-row">
            <span class="confirm-label">日付</span>
            <span class="confirm-value">${y(t)}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-label">時間</span>
            <span class="confirm-value">${h(e.startAt)} - ${h(e.endAt)}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-label">お名前</span>
            <span class="confirm-value">${n?C(n.displayName):"---"}</span>
          </div>
        </div>
        <button class="book-btn" data-action="confirm-booking">予約を確定する</button>
      </div>
    </div>
  `}function m(){const e=b();e.innerHTML=`
    <div class="booking-page">
      <div class="booking-header">
        <h1>予約</h1>
        <p>ご希望の日時をお選びください</p>
      </div>
      ${j()}
      ${z()}
      ${R()}
    </div>
  `,V()}function Y(e,t){const n=b();n.innerHTML=`
    <div class="booking-page">
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h2>予約が完了しました</h2>
        <div class="confirm-details">
          <div class="confirm-row">
            <span class="confirm-label">日付</span>
            <span class="confirm-value">${y(e)}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-label">時間</span>
            <span class="confirm-value">${h(t.startAt)} - ${h(t.endAt)}</span>
          </div>
        </div>
        <p class="success-message">ご予約ありがとうございます。<br>当日のお越しをお待ちしております。</p>
        <button class="close-btn" data-action="close">閉じる</button>
      </div>
    </div>
  `;const a=n.querySelector('[data-action="close"]');a==null||a.addEventListener("click",()=>{liff.isInClient()?liff.closeWindow():window.close()})}function J(e){var n;const t=b();t.innerHTML=`
    <div class="booking-page">
      <div class="card">
        <h2 style="color: #e53e3e;">エラー</h2>
        <p class="error">${C(e)}</p>
        <button class="close-btn" data-action="retry" style="margin-top:16px;">やり直す</button>
      </div>
    </div>
  `,(n=t.querySelector('[data-action="retry"]'))==null||n.addEventListener("click",()=>{c.selectedDate=null,c.selectedSlot=null,c.slots=[],m()})}function V(){const e=b();e.querySelectorAll(".cal-nav").forEach(n=>{n.addEventListener("click",()=>{n.dataset.action==="prev-month"?(c.currentMonth--,c.currentMonth<0&&(c.currentMonth=11,c.currentYear--)):(c.currentMonth++,c.currentMonth>11&&(c.currentMonth=0,c.currentYear++)),c.selectedDate=null,c.selectedSlot=null,c.slots=[],m()})}),e.querySelectorAll(".cal-day.active").forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.date;a&&(c.selectedDate=a,c.selectedSlot=null,c.slots=[],c.loading=!0,m(),G(a))})}),e.querySelectorAll(".slot-btn.available").forEach(n=>{n.addEventListener("click",()=>{const a=n.dataset.start,o=n.dataset.end;c.selectedSlot={startAt:a,endAt:o,available:!0},m(),setTimeout(()=>{const r=b().querySelector(".confirm-section");r==null||r.scrollIntoView({behavior:"smooth"})},50)})});const t=e.querySelector('[data-action="confirm-booking"]');t==null||t.addEventListener("click",()=>K())}async function G(e){try{const t=new URLSearchParams({date:e});w&&t.set("connectionId",w);const n=await S(`/api/integrations/google-calendar/slots?${t}`);if(!n.ok)throw new Error("スロット取得に失敗しました");const a=await n.json();if(!a.success)throw new Error("スロット取得に失敗しました");c.slots=a.data}catch(t){c.slots=[],console.error("fetchSlots error:",t)}finally{c.loading=!1,m()}}async function K(){const{selectedSlot:e,selectedDate:t,profile:n,friendId:a}=c;if(!e||!t||!n||c.submitting)return;c.submitting=!0;const o=b().querySelector('[data-action="confirm-booking"]');o&&(o.disabled=!0,o.textContent="送信中...");try{const r={title:`${n.displayName}様 予約`,startAt:e.startAt,endAt:e.endAt};w&&(r.connectionId=w),a&&(r.friendId=a);const i=await S("/api/integrations/google-calendar/book",{method:"POST",body:JSON.stringify(r)});if(!i.ok){const s=await i.json().catch(()=>null);throw new Error((s==null?void 0:s.error)||"予約に失敗しました")}Y(t,e)}catch(r){c.submitting=!1,J(r instanceof Error?r.message:"予約に失敗しました")}}async function W(){const e=await liff.getProfile();c.profile=e;const t="lh_uuid";try{c.friendId=localStorage.getItem(t)}catch{}const n=liff.getIDToken();if(n){const a=c.friendId;S("/api/liff/link",{method:"POST",body:JSON.stringify({idToken:n,displayName:e.displayName,existingUuid:a})}).then(async o=>{var r;if(o.ok){const i=await o.json();if((r=i==null?void 0:i.data)!=null&&r.userId)try{localStorage.setItem(t,i.data.userId),c.friendId=i.data.userId}catch{}}}).catch(()=>{})}m()}const D="lh_uuid",f={formDef:null,profile:null,friendId:null,submitting:!1};function l(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function I(e,t){return fetch(e,{...t,headers:{"Content-Type":"application/json",...t==null?void 0:t.headers}})}function v(){return document.getElementById("app")}function Q(e){const t=e.required?" required":"",n=e.placeholder?` placeholder="${l(e.placeholder)}"`:"",a=e.required?'<span class="required-mark">*</span>':"";let o="";switch(e.type){case"textarea":o=`<textarea
        name="${l(e.name)}"
        id="field-${l(e.name)}"
        class="form-textarea"
        rows="4"
        ${n}${t}></textarea>`;break;case"select":{const r=(e.options??[]).map(i=>`<option value="${l(i)}">${l(i)}</option>`).join("");o=`<select
        name="${l(e.name)}"
        id="field-${l(e.name)}"
        class="form-select"${t}>
        <option value="">選択してください</option>
        ${r}
      </select>`;break}case"radio":{o=`<div class="radio-group">${(e.options??[]).map(i=>`<label class="radio-label">
              <input type="radio" name="${l(e.name)}" value="${l(i)}"${t} />
              ${l(i)}
            </label>`).join("")}</div>`;break}case"checkbox":{o=`<div class="checkbox-group">${(e.options??[]).map(i=>`<label class="checkbox-label">
              <input type="checkbox" name="${l(e.name)}" value="${l(i)}" />
              ${l(i)}
            </label>`).join("")}</div>`;break}default:o=`<input
        type="${l(e.type)}"
        name="${l(e.name)}"
        id="field-${l(e.name)}"
        class="form-input"
        ${n}${t} />`;break}return`
    <div class="form-field">
      <label class="form-label" for="field-${l(e.name)}">
        ${l(e.label)}${a}
      </label>
      ${o}
    </div>
  `}function X(){if(document.getElementById("form-styles"))return;const e=document.createElement("style");e.id="form-styles",e.textContent=`
    .form-page { max-width: 480px; margin: 0 auto; padding: 16px; }
    .form-header { text-align: center; margin-bottom: 24px; }
    .form-header h1 { font-size: 20px; color: #333; margin-bottom: 8px; }
    .form-description { font-size: 14px; color: #999; }
    .form-profile { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
    .form-profile img { width: 36px; height: 36px; border-radius: 50%; }
    .form-profile span { font-size: 14px; font-weight: 600; }
    .form-body { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .form-field { margin-bottom: 20px; }
    .form-label { display: block; font-size: 14px; font-weight: 600; color: #333; margin-bottom: 6px; }
    .required-mark { color: #e53e3e; margin-left: 2px; }
    .form-input, .form-textarea, .form-select {
      width: 100%; padding: 12px; border: 1.5px solid #e0e0e0; border-radius: 8px;
      font-size: 16px; font-family: inherit; background: #fafafa;
      transition: border-color 0.15s; box-sizing: border-box;
      -webkit-appearance: none;
    }
    .form-input:focus, .form-textarea:focus, .form-select:focus {
      outline: none; border-color: #06C755; background: #fff;
    }
    .form-textarea { resize: vertical; min-height: 80px; }
    .form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
    .radio-group, .checkbox-group { display: flex; flex-direction: column; gap: 10px; }
    .radio-label, .checkbox-label {
      display: flex; align-items: center; gap: 8px; font-size: 15px; color: #333;
      padding: 10px 12px; background: #fafafa; border-radius: 8px; border: 1.5px solid #e0e0e0;
      cursor: pointer; transition: border-color 0.15s;
    }
    .radio-label:has(input:checked), .checkbox-label:has(input:checked) {
      border-color: #06C755; background: #e8faf0;
    }
    .radio-label input, .checkbox-label input { accent-color: #06C755; width: 18px; height: 18px; }
    .radio-label input[type="radio"] { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; border: 2px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; }
    .radio-label input[type="radio"]:checked { background: #06C755; border-color: #06C755; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E"); background-size: 14px; background-position: center; background-repeat: no-repeat; }
    .submit-btn {
      width: 100%; padding: 14px; border: none; border-radius: 8px;
      background: #06C755; color: #fff; font-size: 16px; font-weight: 700;
      cursor: pointer; font-family: inherit; margin-top: 8px; transition: opacity 0.15s;
    }
    .submit-btn:active { opacity: 0.85; }
    .submit-btn:disabled { background: #bbb; cursor: not-allowed; }
    .form-error { color: #e53e3e; font-size: 12px; margin-top: 4px; }
    .form-success { text-align: center; padding: 40px 20px; }
    .form-success .check { width: 64px; height: 64px; border-radius: 50%; background: #06C755; color: #fff; font-size: 32px; line-height: 64px; margin: 0 auto 16px; }
    .form-success h2 { font-size: 20px; color: #06C755; margin-bottom: 12px; }
    .form-success p { font-size: 14px; color: #666; line-height: 1.6; }
  `,document.head.appendChild(e)}function Z(){const{formDef:e,profile:t}=f;if(!e)return;X();const n=v(),a=t!=null&&t.pictureUrl?`<div class="form-profile">
        <img src="${t.pictureUrl}" alt="" />
        <span>${l(t.displayName)} さん</span>
      </div>`:"",o=e.fields.map(Q).join("");n.innerHTML=`
    <div class="form-page">
      <div class="form-header">
        <h1>${l(e.name)}</h1>
        ${e.description?`<p class="form-description">${l(e.description)}</p>`:""}
        ${a}
      </div>
      <form id="liff-form" class="form-body" novalidate>
        ${o}
        <button type="submit" class="submit-btn" id="submitBtn">送信する</button>
      </form>
    </div>
  `,re()}function _(){var t;const e=v();e.innerHTML=`
    <div class="form-page">
      <div class="success-card">
        <div class="success-icon">✓</div>
        <h2>送信完了！</h2>
        <p class="success-message">ご回答ありがとうございました。</p>
        <button class="close-btn" id="closeBtn">閉じる</button>
      </div>
    </div>
  `,(t=document.getElementById("closeBtn"))==null||t.addEventListener("click",()=>{liff.isInClient()?liff.closeWindow():window.close()}),liff.isInClient()&&setTimeout(()=>{try{liff.closeWindow()}catch{}},3e3)}function p(e){const t=v();t.innerHTML=`
    <div class="form-page">
      <div class="card">
        <h2 style="color: #e53e3e;">エラー</h2>
        <p class="error">${l(e)}</p>
      </div>
    </div>
  `}function ee(){const e=v();e.innerHTML=`
    <div class="form-page">
      <div class="card" style="text-align:center;padding:40px 20px;">
        <div class="loading-spinner"></div>
        <p style="margin-top:12px;color:#718096;">読み込み中...</p>
      </div>
    </div>
  `}function te(){const{formDef:e}=f;if(!e)return{};const t={};for(const n of e.fields)if(n.type==="checkbox"){const a=Array.from(document.querySelectorAll(`input[name="${n.name}"]:checked`)).map(o=>o.value);t[n.name]=a}else if(n.type==="radio"){const a=document.querySelector(`input[name="${n.name}"]:checked`);t[n.name]=(a==null?void 0:a.value)??""}else{const a=document.querySelector(`[name="${n.name}"]`);t[n.name]=(a==null?void 0:a.value)??""}return t}function ne(){const{formDef:e}=f;if(!e)return null;for(const t of e.fields)if(t.required)if(t.type==="checkbox"){if(document.querySelectorAll(`input[name="${t.name}"]:checked`).length===0)return`${t.label} は必須項目です`}else if(t.type==="radio"){if(!document.querySelector(`input[name="${t.name}"]:checked`))return`${t.label} は必須項目です`}else{const n=document.querySelector(`[name="${t.name}"]`);if(!n||!n.value.trim())return`${t.label} は必須項目です`}return null}async function ae(){var n,a,o;if(f.submitting||!f.formDef)return;const e=ne();if(e){const r=v().querySelector(".form-error-msg");r&&r.remove();const i=document.createElement("p");i.className="form-error-msg",i.style.cssText="color:#e53e3e;font-size:14px;margin:8px 0;text-align:center;",i.textContent=e;const s=document.getElementById("submitBtn");(n=s==null?void 0:s.parentElement)==null||n.insertBefore(i,s);return}f.submitting=!0;const t=document.getElementById("submitBtn");t&&(t.disabled=!0,t.textContent="送信中...");try{const r=te();console.log("Form data collected:",JSON.stringify(r));const i={data:r};(a=f.profile)!=null&&a.userId&&(i.lineUserId=f.profile.userId),console.log("Submitting to:",`/api/forms/${f.formDef.id}/submit`);const s=await I(`/api/forms/${f.formDef.id}/submit`,{method:"POST",body:JSON.stringify(i)});if(console.log("Response status:",s.status),!s.ok){const d=await s.text().catch(()=>"");let u="送信に失敗しました";try{u=JSON.parse(d).error||u}catch{u=d||u}throw new Error(`${s.status}: ${u}`)}_()}catch(r){f.submitting=!1,t&&(t.disabled=!1,t.textContent="送信する");const i=v().querySelector(".form-error-msg");i&&i.remove();const s=document.createElement("p");s.className="form-error-msg",s.style.cssText="color:#e53e3e;font-size:14px;margin:8px 0;text-align:center;",s.textContent=r instanceof Error?r.message:"送信に失敗しました";const d=document.getElementById("submitBtn");(o=d==null?void 0:d.parentElement)==null||o.insertBefore(s,d)}}function re(){const e=document.getElementById("liff-form");e==null||e.addEventListener("submit",t=>{t.preventDefault(),ae()})}async function oe(e){if(!e){p("フォームIDが指定されていません");return}ee();try{const[t,n]=await Promise.all([liff.getProfile(),I(`/api/forms/${e}`)]);f.profile=t;try{f.friendId=localStorage.getItem(D)}catch{}const a=liff.getIDToken();if(a&&I("/api/liff/link",{method:"POST",body:JSON.stringify({idToken:a,displayName:t.displayName,existingUuid:f.friendId})}).then(async r=>{var i;if(r.ok){const s=await r.json();if((i=s==null?void 0:s.data)!=null&&i.userId)try{localStorage.setItem(D,s.data.userId),f.friendId=s.data.userId}catch{}}}).catch(()=>{}),!n.ok){n.status===404?p("フォームが見つかりません"):p("フォームの読み込みに失敗しました");return}const o=await n.json();if(!o.success||!o.data){p("フォームの読み込みに失敗しました");return}if(!o.data.isActive){p("このフォームは現在受付を停止しています");return}f.formDef=o.data,Z()}catch(t){p(t instanceof Error?t.message:"エラーが発生しました")}}const g={};function se(){const t=new URLSearchParams(window.location.search).get("liffId");return t||(g==null?void 0:g.VITE_LIFF_ID)||""}const L=se();if(!L&&!new URLSearchParams(window.location.search).get("liffId"))throw new Error("VITE_LIFF_ID is not set and no liffId query param provided. Set VITE_LIFF_ID in .env (local) or GitHub Secrets (CI).");const A="lh_uuid",x=(g==null?void 0:g.VITE_BOT_BASIC_ID)||"";function T(e,t){return fetch(e,{...t,headers:{"Content-Type":"application/json",...t==null?void 0:t.headers}})}function ie(){return window.location.pathname.replace(/^\/+/,"")==="book"?"book":new URLSearchParams(window.location.search).get("page")}function ce(){return new URLSearchParams(window.location.search).get("redirect")}function M(){return new URLSearchParams(window.location.search).get("ref")}function le(){try{return localStorage.getItem(A)}catch{return null}}function de(e){try{localStorage.setItem(A,e)}catch{}}function $(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function fe(e){const t=document.getElementById("app"),n=x?`https://line.me/R/ti/p/${x}`:"#";t.innerHTML=`
    <div class="card">
      <div class="profile">
        ${e.pictureUrl?`<img src="${e.pictureUrl}" alt="" />`:""}
        <p class="name">${$(e.displayName)} さん</p>
      </div>
      <p class="message">まずは友だち追加をお願いします</p>
      <a href="${n}" class="add-friend-btn" id="addFriendBtn">
        友だち追加して始める
      </a>
      <p class="sub-message">追加後、この画面に戻ってきてください</p>
    </div>
  `,document.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible")try{const{friendFlag:a}=await liff.getFriendship();a&&N(e,!1)}catch{}})}function N(e,t){const n=document.getElementById("app"),a=M();n.innerHTML=`
    <div class="card">
      <div class="check-icon">${t?"🔄":"✓"}</div>
      <h2>${t?"おかえりなさい！":"登録完了！"}</h2>
      <div class="profile">
        ${e.pictureUrl?`<img src="${e.pictureUrl}" alt="" />`:""}
        <p class="name">${$(e.displayName)} さん</p>
      </div>
      <p class="message">
        ${t?"以前のアカウント情報を引き継ぎました。":"ありがとうございます！これからお役立ち情報をお届けします。"}
        <br>このページは閉じて大丈夫です。
      </p>
      ${a?`<p class="ref-badge">${$(a)}</p>`:""}
    </div>
  `,x&&setTimeout(()=>{window.location.href=`https://line.me/R/oaMessage/${x}/`},2e3)}function F(e){const t=document.getElementById("app");t.innerHTML=`
    <div class="card">
      <h2>エラー</h2>
      <p class="error">${$(e)}</p>
    </div>
  `}async function ue(){const e=ce(),t=M();try{const n=le(),[a,o,r]=await Promise.all([liff.getProfile(),Promise.resolve(liff.getIDToken()),liff.getFriendship()]),i=T("/api/liff/link",{method:"POST",body:JSON.stringify({idToken:o,displayName:a.displayName,existingUuid:n,ref:t})}).then(async s=>{var d;if(s.ok){const u=await s.json();(d=u==null?void 0:u.data)!=null&&d.userId&&de(u.data.userId)}return s}).catch(()=>{});if(t&&T("/api/affiliates/click",{method:"POST",body:JSON.stringify({code:t,url:window.location.href})}).catch(()=>{}),e){if(await Promise.race([i,new Promise(s=>setTimeout(s,500))]),e.includes("/t/")){const s=e.includes("?")?"&":"?";window.location.href=`${e}${s}lu=${encodeURIComponent(a.userId)}`}else window.location.href=e;return}await i,r.friendFlag?N(a,!!n):fe(a)}catch(n){e?window.location.href=e:F(n instanceof Error?n.message:"エラーが発生しました")}}async function pe(){try{if(await liff.init({liffId:L}),!liff.isLoggedIn()){liff.login({redirectUri:window.location.href});return}const e=ie();if(e==="book")await W();else if(e==="form"){const n=new URLSearchParams(window.location.search).get("id");await oe(n)}else await ue()}catch(e){F(e instanceof Error?e.message:"LIFF初期化エラー")}}pe();
