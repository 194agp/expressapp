const puppeteer = require('puppeteer');

async function scrapeInstagramProfile(username) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/114.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 800 });

  // Delay manual (compatível com todas as versões)
  await new Promise(res =>
    setTimeout(res, 500 + Math.random() * 500)
  );

  await page.goto(`https://www.instagram.com/${username}/`, {
    waitUntil: 'networkidle2',
    timeout: 0
  });

  const user = await page.evaluate(() =>
    window._sharedData.entry_data.ProfilePage[0].graphql.user
  );
  await browser.close();

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    biography: user.biography,
    followers: user.edge_followed_by.count,
    following: user.edge_follow.count,
    posts: user.edge_owner_to_timeline_media.count,
    avatarUrl: user.profile_pic_url_hd
  };
}

module.exports = scrapeInstagramProfile;
