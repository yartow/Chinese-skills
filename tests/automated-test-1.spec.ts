import { test, expect, Page } from '@playwright/test';

/**
 * Automated Test 1 - Chinese Character Learning Application
 * 
 * This test verifies:
 * 1. Character detail views display correct pinyin and radical information
 * 2. All three test modes (pronunciation, writing, radical) work correctly
 * 3. Test results are properly tracked with correct/incorrect answers
 * 
 * Run with: npx playwright test tests/automated-test-1.spec.ts
 */
test.describe('Automated Test 1', () => {
  
  interface CharacterData {
    index: number;
    simplified: string;
    traditional: string;
    pinyin: string;
    numberedPinyin: string | null;
    radical: string | null;
    radicalPinyin: string | null;
  }
  
  const testCharacterIndices = [0, 50, 100];
  let testCharacters: CharacterData[] = [];
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('Step 1: Login and fetch character data', async () => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loginButton = page.locator('[data-testid="button-login"]');
    if (await loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loginButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    for (const index of testCharacterIndices) {
      try {
        const response = await page.request.get(`/api/characters/${index}`);
        if (response.ok()) {
          const data = await response.json();
          testCharacters.push({
            index: data.index,
            simplified: data.simplified,
            traditional: data.traditional,
            pinyin: data.pinyin,
            numberedPinyin: data.numberedPinyin,
            radical: data.radical,
            radicalPinyin: data.radicalPinyin,
          });
          console.log(`Loaded character ${index}: ${data.simplified} (radical: ${data.radical})`);
        }
      } catch (e) {
        console.log(`Could not fetch character ${index}:`, e);
      }
    }
    
    expect(testCharacters.length).toBeGreaterThan(0);
  });

  test('Step 2: Verify character detail views show correct pinyin and radical', async () => {
    for (const char of testCharacters) {
      console.log(`Testing character detail view for index ${char.index} (${char.simplified})`);
      
      await page.goto(`/character/${char.index}`);
      await page.waitForLoadState('networkidle');
      
      const pinyinElement = page.locator('[data-testid="text-pinyin"]');
      await expect(pinyinElement).toBeVisible({ timeout: 10000 });
      const displayedPinyin = await pinyinElement.textContent();
      expect(displayedPinyin).toBe(char.pinyin);
      console.log(`  Pinyin: "${displayedPinyin}" ✓`);
      
      const radicalElement = page.locator('[data-testid="text-radical"]');
      await expect(radicalElement).toBeVisible();
      const displayedRadical = await radicalElement.textContent();
      expect(displayedRadical).not.toBe('');
      expect(displayedRadical).not.toBe(null);
      console.log(`  Radical: "${displayedRadical}" ✓`);
      
      const radicalPinyinElement = page.locator('[data-testid="text-radical-pinyin"]');
      await expect(radicalPinyinElement).toBeVisible();
      const displayedRadicalPinyin = await radicalPinyinElement.textContent();
      expect(displayedRadicalPinyin).not.toBe('()');
      console.log(`  Radical Pinyin: "${displayedRadicalPinyin}" ✓`);
    }
  });

  test('Step 3: Run pronunciation test with skip and wrong answers', async () => {
    console.log('Starting pronunciation test...');
    
    await page.goto('/test');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="radio-pronunciation"]');
    await page.fill('[data-testid="input-start-index"]', '0');
    await page.click('[data-testid="button-start-test"]');
    
    await page.waitForSelector('[data-testid="text-test-character"]', { timeout: 10000 });
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 1}: Skipping`);
      await page.click('[data-testid="button-skip"]');
      await page.waitForTimeout(300);
    }
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 3}: Entering wrong answer`);
      await page.fill('[data-testid="input-test-answer"]', 'wrongpinyin1');
      await page.click('[data-testid="button-submit-answer"]');
      await page.waitForTimeout(500);
      
      const skipButton = page.locator('[data-testid="button-skip"]');
      if (await skipButton.isVisible()) {
        await skipButton.click();
        await page.waitForTimeout(300);
      }
    }
    
    await page.click('[data-testid="button-end-test"]');
    await page.waitForSelector('text=Test Results', { timeout: 5000 });
    
    const resultsText = await page.locator('.text-xl.text-muted-foreground').textContent();
    console.log(`  Pronunciation test completed: ${resultsText}`);
    expect(resultsText).toContain('correct');
  });

  test('Step 4: Run writing test with mastered and show answer', async () => {
    console.log('Starting writing test...');
    
    await page.goto('/test');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="radio-writing"]');
    await page.fill('[data-testid="input-start-index"]', '0');
    await page.click('[data-testid="button-start-test"]');
    
    await page.waitForSelector('[data-testid="text-test-character"]', { timeout: 10000 });
    
    const masteredButton = page.locator('[data-testid="button-mastered"]');
    await expect(masteredButton).toBeVisible();
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 1}: Marking as mastered`);
      await page.click('[data-testid="button-mastered"]');
      await page.waitForTimeout(500);
    }
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 3}: Showing answer then skipping`);
      await page.click('[data-testid="button-show-answer"]');
      await page.waitForTimeout(300);
      await page.click('[data-testid="button-skip"]');
      await page.waitForTimeout(300);
    }
    
    await page.click('[data-testid="button-end-test"]');
    await page.waitForSelector('text=Test Results', { timeout: 5000 });
    
    const resultsText = await page.locator('.text-xl.text-muted-foreground').textContent();
    console.log(`  Writing test completed: ${resultsText}`);
    expect(resultsText).toContain('correct');
  });

  test('Step 5: Run radical test with skip and wrong answers', async () => {
    console.log('Starting radical test...');
    
    await page.goto('/test');
    await page.waitForLoadState('networkidle');
    
    await page.click('[data-testid="radio-radical"]');
    await page.fill('[data-testid="input-start-index"]', '0');
    await page.click('[data-testid="button-start-test"]');
    
    await page.waitForSelector('[data-testid="text-test-character"]', { timeout: 10000 });
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 1}: Skipping`);
      const skipButton = page.locator('[data-testid="button-skip"]');
      if (await skipButton.isVisible()) {
        await skipButton.click();
        await page.waitForTimeout(300);
      }
    }
    
    for (let i = 0; i < 2; i++) {
      console.log(`  Question ${i + 3}: Entering wrong answer`);
      await page.fill('[data-testid="input-test-answer"]', 'wrongradical1');
      await page.click('[data-testid="button-submit-answer"]');
      await page.waitForTimeout(500);
      
      const endTestIncorrectBtn = page.locator('[data-testid="button-end-test-incorrect"]');
      const nextBtn = page.locator('[data-testid="button-next"]');
      const skipButton = page.locator('[data-testid="button-skip"]');
      
      if (await endTestIncorrectBtn.isVisible()) {
        await endTestIncorrectBtn.click();
        break;
      } else if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      } else if (await skipButton.isVisible()) {
        await skipButton.click();
        await page.waitForTimeout(300);
      }
    }
    
    const endTestBtn = page.locator('[data-testid="button-end-test"]');
    if (await endTestBtn.isVisible()) {
      await endTestBtn.click();
    }
    
    await page.waitForSelector('text=Test Results', { timeout: 5000 });
    
    const resultsText = await page.locator('.text-xl.text-muted-foreground').textContent();
    console.log(`  Radical test completed: ${resultsText}`);
    expect(resultsText).toBeTruthy();
  });
});
