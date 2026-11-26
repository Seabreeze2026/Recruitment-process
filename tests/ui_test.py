# Brauzer testi: python3 tests/ui_test.py  (əvvəlcə node tests/server.js işə salın)
import sys, os, re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8080"
OUT = "/tmp/shots"
os.makedirs(OUT, exist_ok=True)
errors = []

def shot(page, name):
    page.wait_for_timeout(250)
    page.screenshot(path=f"{OUT}/{name}.png", full_page=True)

def login(page, u, p):
    page.goto(f"{BASE}/?api=/api")
    page.fill("input[name=username]", u)
    page.fill("input[name=password]", p)
    page.click("button[type=submit]")
    page.wait_for_selector(".sidebar")

def run(page, br, ctx):

    # Giriş səhvi
    page.goto(f"{BASE}/?api=/api")
    page.fill("input[name=username]", "sebnem"); page.fill("input[name=password]", "yanlis"); page.click("button[type=submit]")
    page.wait_for_selector(".err-box"); shot(page, "00_login_error")

    login(page, "sebnem", "Test2026")
    shot(page, "01_panel_recruiter")

    # Vakansiya yarat
    page.click("a[data-route=vacancies]"); page.wait_for_selector("h1:has-text('Vakansiyalar')")
    shot(page, "02_vacancies")
    page.click("button[data-act=newVacancy]")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".modal .err-box")  # boş forma xətası
    page.fill(".modal input[name=title]", "Satış meneceri")
    page.select_option(".modal select[name=company]", "CROCUS FITNESS MMC")
    page.select_option(".modal select[name=department]", "Satış")
    page.fill(".modal input[name=hiringManager]", "Fərid Əliyev")
    page.fill(".modal input[name=salaryMin]", "1200"); page.fill(".modal input[name=salaryMax]", "1500")
    shot(page, "03_vacancy_form")
    page.click(".modal button[type=submit]")
    page.wait_for_selector("h1:has-text('Satış meneceri')")
    shot(page, "04_vacancy_detail")

    # Yeni namizəd + vakansiyaya əlavə + dublikat xəbərdarlığı
    page.click("button[data-act=addToVacancy]")
    page.click(".modal [data-act=newCandForVac]")
    page.fill(".modal input[name=fullName]", "Nəbiyev Kamran")
    page.fill(".modal input[name=phone]", "050 111 22 33")  # Yasəmənin nömrəsi -> dublikat
    page.wait_for_selector(".modal .hint-box")
    shot(page, "05_duplicate_hint")
    page.fill(".modal input[name=phone]", "0509990011")
    page.select_option(".modal select[name=source]", "Tövsiyə")
    page.fill(".modal input[name=sourceNote]", "Rüstəm müəllim")
    page.click(".modal button[type=submit]")
    page.wait_for_selector("td:has-text('Nəbiyev Kamran')")

    # Müsahibə yarat (bu gün, keçirilib)
    page.click("tr:has-text('Nəbiyev Kamran')")
    page.wait_for_selector(".modal h2:has-text('Nəbiyev Kamran')")
    shot(page, "06_application_modal")
    page.click(".modal [data-act=newInterviewFor]")
    page.wait_for_selector(".modal h2:has-text('Yeni müsahibə')")
    form = page.locator(".modal-back").last
    form.locator("input[name=startTime]").fill("09:00")
    form.locator("select[name=attendance]").select_option("İştirak edib")
    form.locator("input[name=endTime]").fill("09:40")
    form.locator("select[name=result]").select_option("Bəyənildi")
    form.locator("textarea[name=comment]").fill("Satış təcrübəsi güclüdür.")
    shot(page, "07_interview_form")
    form.locator("button[type=submit]").click()
    page.wait_for_selector(".modal h2:has-text('Müsahibə — Nəbiyev Kamran')")
    shot(page, "08_interview_saved")

    # Öz qiymətləndirmə kartı
    page.locator(".modal-back").last.locator("[data-act=myScorecard]").click()
    page.wait_for_selector(".modal h2:has-text('Qiymətləndirmə kartı')")
    card = page.locator(".modal-back").last
    for i in range(5):
        card.locator(f"label:has(input[name=c{i}][value='4'])").click()
    card.locator("select[name=recommendation]").select_option("Tövsiyə edirəm")
    shot(page, "09_scorecard")
    card.locator("button[type=submit]").click()
    page.wait_for_selector(".modal td:has-text('Təhvil verildi')")

    # Rəhbər linki
    page.locator(".modal-back").last.locator("[data-act=scLink]").click()
    page.wait_for_selector(".modal h2:has-text('Rəhbər üçün')")
    page.locator(".modal-back").last.locator("button[type=submit]").click()
    page.wait_for_selector(".modal h2:has-text('Qiymətləndirmə linki')")
    link = page.locator("#linkInp").input_value()
    shot(page, "10_link")
    # bütün modalları bağla
    page.keyboard.press("Escape")
    page.evaluate("document.querySelectorAll('.modal-back').forEach(m=>m.remove())")

    # Linki ayrı (girişsiz) kontekstdə aç
    ctx2 = br.new_context(viewport={"width": 420, "height": 900})
    p2 = ctx2.new_page()
    p2.on("pageerror", lambda e: errors.append("EVAL PAGEERROR: " + str(e)))
    p2.goto(link.replace("http://localhost:8080/", BASE + "/"))
    p2.wait_for_selector("h1:has-text('Namizədin qiymətləndirilməsi')")
    p2.click("button[type=submit]"); p2.wait_for_selector(".err-box")
    for i in range(5):
        p2.click(f"label:has(input[name=c{i}][value='{3 + i % 3}'])")
    p2.select_option("select[name=recommendation]", "Tövsiyə edirəm")
    p2.fill("textarea[name=comment]", "Komandaya uyğundur.")
    p2.screenshot(path=f"{OUT}/11_evaluate_mobile.png", full_page=True)
    p2.click("button[type=submit]")
    p2.wait_for_selector("h2:has-text('Təşəkkür')")
    p2.screenshot(path=f"{OUT}/12_evaluate_done.png")
    p2.reload(); p2.wait_for_selector("text=artıq təhvil verilib")
    p2.goto(BASE + "/evaluate.html?t=yanlis" + "x" * 40 + "&api=/api"); p2.wait_for_selector(".err-box")

    # Lövhə: sürüşdürmə
    page.reload(); page.wait_for_selector(".sidebar")
    page.click("a[data-route=board]"); page.wait_for_selector(".board")
    shot(page, "13_board")
    page.drag_and_drop(".kcard:has-text('Nəbiyev Kamran')", ".col[data-stage='Final']")
    page.wait_for_selector(".col[data-stage='Final'] .kcard:has-text('Nəbiyev Kamran')")
    page.drag_and_drop(".kcard:has-text('Nəbiyev Kamran')", ".col[data-stage='Təklif']")
    page.wait_for_selector(".modal h2:has-text('İş təklifi')")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".col[data-stage='Təklif'] .kcard:has-text('Nəbiyev Kamran')")
    page.drag_and_drop(".kcard:has-text('Nəbiyev Kamran')", ".col[data-stage='İşə qəbul']")
    page.wait_for_selector(".modal h2:has-text('İşə qəbul')")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".modal h2:has-text('Vakansiya dolduruldu')")
    shot(page, "14_vacancy_filled")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".modal h2:has-text('Rəhbər məmnuniyyəti')")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".modal h2:has-text('Qiymətləndirmə linki')")
    sat_link = page.locator("#linkInp").input_value()
    page.evaluate("document.querySelectorAll('.modal-back').forEach(m=>m.remove())")
    p2.goto(sat_link); p2.wait_for_selector("h1:has-text('Recruiter işinin')")
    p2.click("label:has(input[name=score][value='5'])")
    p2.screenshot(path=f"{OUT}/15_satisfaction.png", full_page=True)
    p2.click("button[type=submit]"); p2.wait_for_selector("h2:has-text('Təşəkkür')")

    # İmtina mərhələsi modalı
    page.reload(); page.wait_for_selector(".sidebar")
    page.click("a[data-route=board]"); page.wait_for_selector(".board")
    page.drag_and_drop(".kcard:has-text('Axmerova Zarina')", ".col[data-stage='İmtina']")
    page.wait_for_selector(".modal h2:has-text('İmtina')")
    page.click(".modal label:has-text('Namizəd')")
    shot(page, "16_reject_modal")
    page.locator(".modal select[name=rejectReason]:not([disabled])").select_option("Əlaqə saxlamadı")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".col[data-stage='İmtina'] .kcard:has-text('Axmerova Zarina')")

    # Müsahibələr: siyahı və təqvim
    page.click("a[data-route=interviews]"); page.wait_for_selector("h1:has-text('Müsahibələr')")
    shot(page, "17_interviews")
    page.click("button[data-act=intMode][data-mode=week]"); page.wait_for_selector(".week")
    shot(page, "18_week")

    # Namizədlər
    page.click("a[data-route=candidates]"); page.wait_for_selector("h1:has-text('Namizədlər')")
    page.fill("input[data-filter='cand.q']", "0501")
    page.wait_for_timeout(400)
    shot(page, "19_candidates_search")

    # Performans (recruiter)
    page.click("a[data-route=performance]"); page.wait_for_selector(".metric-card")
    shot(page, "20_perf_recruiter")

    # Admin
    page.click("a[data-act=logout]"); page.wait_for_selector("#loginForm")
    login(page, "admin", "Admin2026")
    shot(page, "21_panel_admin")
    page.click("a[data-route=performance]"); page.wait_for_selector(".metric-card")
    page.select_option("select[data-filter='perf.preset']", "q"); page.wait_for_selector(".metric-card")
    shot(page, "22_perf_admin")
    page.click("a[data-route=admin]"); page.wait_for_selector("h1:has-text('Admin')")
    page.click("button[data-act=newUser]")
    page.fill(".modal input[name=fullName]", "Test İstifadəçi"); page.fill(".modal input[name=username]", "test.user")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".modal h2:has-text('Giriş məlumatları')")
    shot(page, "23_new_user_pw")
    temp = page.locator(".modal code").nth(1).inner_text()
    page.evaluate("document.querySelectorAll('.modal-back').forEach(m=>m.remove())")
    shot(page, "24_admin_users")
    page.click("button[data-act=adminTab][data-tab=params]"); page.wait_for_selector("#paramsForm")
    shot(page, "25_admin_params")
    page.fill("input[name=w_P1]", "30"); page.click("button[data-act=saveParams]")
    page.wait_for_selector(".toast.bad")
    page.fill("input[name=w_P1]", "20")
    page.click("button[data-act=adminTab][data-tab=lists]"); page.wait_for_selector("#listsForm")
    shot(page, "26_admin_lists")
    page.click("button[data-act=adminTab][data-tab=audit]"); page.wait_for_selector("td")
    shot(page, "27_audit")

    # Yeni istifadəçi ilk giriş: parol dəyişmə məcburidir
    page.click("a[data-act=logout]"); page.wait_for_selector("#loginForm")
    page.fill("input[name=username]", "test.user"); page.fill("input[name=password]", temp); page.click("button[type=submit]")
    page.wait_for_selector(".modal h2:has-text('Yeni parol')")
    shot(page, "28_force_pw")
    page.fill(".modal input[name=oldPassword]", temp)
    page.fill(".modal input[name=newPassword]", "Yeni2026x"); page.fill(".modal input[name=newPassword2]", "Yeni2026x")
    page.click(".modal button[type=submit]")
    page.wait_for_selector(".toast:has-text('Parol dəyişdirildi')")

    # Mobil görünüş
    m = br.new_context(viewport={"width": 390, "height": 844})
    mp = m.new_page()
    mp.goto(f"{BASE}/?api=/api"); mp.fill("input[name=username]", "sebnem"); mp.fill("input[name=password]", "Test2026"); mp.click("button[type=submit]")
    mp.wait_for_selector(".sidebar")
    mp.screenshot(path=f"{OUT}/29_mobile_panel.png", full_page=True)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 1920, "height": 1000})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "sheetjs" not in m.text and "ERR_" not in m.text else None)
    page.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))
    page.on("dialog", lambda d: d.accept())
    try:
        run(page, br, ctx)
    except Exception:
        page.screenshot(path=f"{OUT}/FAIL.png", full_page=True)
        print("MODALS:", page.locator(".modal h2").all_inner_texts())
        raise
    br.close()

print("Konsol xətaları:", errors if errors else "yoxdur")
print("OK")
