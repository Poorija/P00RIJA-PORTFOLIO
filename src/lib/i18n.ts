// UI chrome translations (buttons, labels, CMS) — separate from CMS-managed content.
import type { Lang } from "./content-types";

export const translations = {
  fa: {
    dir: "rtl",
    langName: "فارسی",
    otherLang: "EN",
    // header
    menu: "منو",
    theme: "تغییر تم",
    cms: "مدیریت محتوا",
    login: "ورود",
    logout: "خروج",
    // login modal
    loginTitle: "ورود به مدیریت محتوا",
    loginSubtitle: "برای ویرایش سایت وارد شوید",
    password: "رمز عبور",
    passwordPlaceholder: "رمز عبور را وارد کنید",
    loginBtn: "ورود",
    loginError: "رمز عبور نادرست است",
    // cms
    cmsTitle: "مدیریت محتوا",
    cmsSubtitle: "ویرایش زنده — تغییرات بلافاصله ذخیره می‌شوند",
    save: "ذخیره تغییرات",
    close: "بستن",
    add: "افزودن",
    addItem: "افزودن مورد",
    section: "بخش",
    language: "زبان",
    saved: "بخش ذخیره شد",
    saveError: "خطا در ذخیره",
    // games
    play: "بازی کن",
    score: "امتیاز",
    best: "رکورد",
    reset: "شروع دوباره",
    newGame: "بازی جدید",
    // gallery
    enterGallery: "ورود به گالری",
    exitGallery: "خروج از گالری",
    nextArt: "بعدی",
    prevArt: "قبلی",
    // misc
    loading: "در حال بارگذاری...",
    back: "بازگشت",
  },
  en: {
    dir: "ltr",
    langName: "English",
    otherLang: "فا",
    menu: "Menu",
    theme: "Toggle theme",
    cms: "Content manager",
    login: "Login",
    logout: "Logout",
    loginTitle: "Login to content manager",
    loginSubtitle: "Sign in to edit the site",
    password: "Password",
    passwordPlaceholder: "Enter password",
    loginBtn: "Login",
    loginError: "Incorrect password",
    cmsTitle: "Content Manager",
    cmsSubtitle: "Live editing — changes save instantly",
    save: "Save changes",
    close: "Close",
    add: "Add",
    addItem: "Add item",
    section: "Section",
    language: "Language",
    saved: "Section saved",
    saveError: "Save failed",
    play: "Play",
    score: "Score",
    best: "Best",
    reset: "Reset",
    newGame: "New game",
    enterGallery: "Enter gallery",
    exitGallery: "Exit gallery",
    nextArt: "Next",
    prevArt: "Previous",
    loading: "Loading...",
    back: "Back",
  },
} as const;

export type TranslationKey = keyof typeof translations.fa;

export function getT(lang: Lang) {
  return (key: TranslationKey): string => translations[lang][key] ?? translations.fa[key] ?? key;
}
