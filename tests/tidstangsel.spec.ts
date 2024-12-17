/*
TODO WRITE TESTS 
*/

import { test, expect } from "@playwright/test";
const inside_perim_pos = { latitude: 65.9297, longitude: 23.795 };
const inside_map_pos = { latitude: 65.8725, longitude: 23.3226 };
const outside_map_pos = { latitude: 65.987, longitude: 22.451 };

test.use({
	geolocation: inside_map_pos,
	permissions: ["geolocation"],
});

test("outofbounds_on_startup", async ({ page, context }) => {
	let consoleLogs: string[] = [];
	//logs all console messages
	page.on("console", (msg) => {
		consoleLogs.push(msg.text);
		console.log(msg);
	});
	await context.setGeolocation(outside_map_pos);
	await context.grantPermissions(["geolocation"]);
	await page.goto("/tidstangsel");
	await page.waitForTimeout(2000);
	let htmlBody = await page.locator("body").allInnerTexts();
	console.log("htmlbody", htmlBody);
	//expect(htmlBody).toContain("<img id='static_map' src='/static_map.png'");  //await expect(scriptTag).not.toHaveAttribute('data-nonce');
	expect(consoleLogs.includes("out of bounds"));
});
/*
test('perim_enter_on_startup', async ({page, context})=> {
  let consoleLogs :string[] = [];
  page.on('console', msg => {console.log(msg); consoleLogs.push(msg.text())});
  await context.setGeolocation(inside_perim_pos);
  await page.goto("/tidstangsel",{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(5000);
  await page.click('#start_stream_btn');
  await page.waitForTimeout(20000);
  const successLog = consoleLogs.includes("stream is playing");
  expect(successLog).toBe(true);
});

test('perim_enter', async ({page, context})=> {
  let consoleLogs :string[] = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  await context.setGeolocation(inside_map_pos);
  await page.goto("/tidstangsel");
  await page.waitForTimeout(5000);
  await context.setGeolocation(inside_perim_pos);
  await page.waitForTimeout(5000);
  const successLog = consoleLogs.includes("stream is playing");
  expect(successLog).toBe(true);
});

test('perim_enter_exit', async ({page, context})=> {
  let consoleLogs :string[] = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  await context.setGeolocation(inside_map_pos);
  await page.goto("http://localhost:3000/tidstangsel");
  await page.waitForTimeout(5000);
  await context.setGeolocation(inside_perim_pos);
  await page.waitForTimeout(5000);
  await context.setGeolocation(inside_map_pos);
  await page.waitForTimeout(5000);
  const successLog = consoleLogs.includes("stream closed") && consoleLogs.includes("stream is playing");
  expect(successLog).toBe(true);
});

test('perim_enter_exit_outofbounds', async ({page, context})=> {
  let consoleLogs :string[] = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  await context.setGeolocation(inside_map_pos);
  await page.goto("http://localhost:3000/tidstangsel");
  await page.waitForTimeout(5000);
  await context.setGeolocation(inside_perim_pos);
  await page.waitForTimeout(5000);
  await context.setGeolocation(inside_map_pos);
  await page.waitForTimeout(5000);
  await context.setGeolocation(outside_map_pos);
  await page.waitForTimeout(5000);
  const successLog = consoleLogs.includes("stream is playing") && consoleLogs.includes("stream closed");
  expect(successLog).toBe(true);
  const staticMap = page.locator('#static_map');
  await expect(staticMap).toBeVisible();
  await expect(staticMap).not.toHaveAttribute('data-nonce');
});
*/
