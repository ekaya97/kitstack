/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || "https://kitstack.co",
  generateRobotsTxt: true,
  generateIndexSitemap: false,
};
