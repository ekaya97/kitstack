/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://kitstack.dev",
  generateRobotsTxt: true,
  generateIndexSitemap: false,
};
