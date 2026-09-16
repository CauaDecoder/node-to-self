import { expect, test } from '@playwright/test'

test('creates nodes and restores the project after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('banner')).toContainText('Mind Map')
  await expect(page.getByRole('region', { name: 'Project canvas' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible()
  await page.getByRole('button', { name: 'Add node' }).click()
  await page.getByRole('button', { name: 'Add node' }).click()
  await expect(page.getByText('New concept')).toHaveCount(2)
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 2_000 })
  await page.reload()
  await expect(page.getByText('New concept')).toHaveCount(2)
})
