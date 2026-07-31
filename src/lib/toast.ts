// Ekranın altında "Kaydedildi" onayı — herhangi bir yerde kayıt başarılı olunca çağır.
// Global bir custom event yayar; <Toaster/> (layout'ta) dinleyip gösterir.
export function kaydedildiGoster(mesaj = "Kaydedildi") {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("app-kaydedildi", { detail: mesaj }))
}
