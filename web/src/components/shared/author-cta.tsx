export function AuthorCTA() {
  return (
    <div className="bg-ks-ink rounded-xl p-4 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-8">
      <div>
        <div className="font-serif text-[24px] text-ks-paper tracking-tight">
          Build kits. Earn revenue.
        </div>
        <p className="font-sans text-[14px] text-ks-paper-deep mt-1.5 leading-relaxed max-w-md">
          Become a KitStack author &mdash; contribute skills and kits, and earn
          a share of the revenue your creations generate. We handle auth,
          infrastructure, and billing. You focus on the product.
        </p>
      </div>
      <a
        href="mailto:hello@kitstack.co?subject=Interested%20in%20becoming%20a%20KitStack%20author"
        className="ks-btn ks-btn-accent !py-3 !px-6 !text-[14px] shrink-0"
      >
        Get in touch &rarr;
      </a>
    </div>
  );
}
