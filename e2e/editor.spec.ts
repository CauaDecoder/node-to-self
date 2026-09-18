import { expect, test, type Page } from '@playwright/test'

async function createProject(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('region', { name: 'Project canvas' })).toBeVisible()
}

async function nodeBox(page: Page, index: number): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('.react-flow__node').nth(index).boundingBox()
  if (!box) throw new Error('Node is not visible.')
  return box
}

async function addNodeFromToolbar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add node' }).click()
  await page.getByRole('menuitem').first().click()
}

async function waitForSaved(page: Page): Promise<void> {
  await expect(page.locator('.save-status')).toHaveText(/Saved/, { timeout: 3_000 })
}

test('creates nodes and restores the project after reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('banner')).toContainText('Mind Map')
  await expect(page.getByRole('region', { name: 'Project canvas' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Details drawer' })).not.toBeVisible()
  await addNodeFromToolbar(page)
  await addNodeFromToolbar(page)
  await expect(page.locator('.concept-node strong')).toHaveCount(2)
  await waitForSaved(page)
  await page.reload()
  await expect(page.locator('.concept-node strong')).toHaveCount(2)
})

test('keeps a dragged position after reload with a single undo step', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await addNodeFromToolbar(page)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  // Two nodes keep fitView's pan/zoom stable across reloads, so the offset
  // between them (rather than either node's absolute page position) is what
  // proves the drag persisted instead of just reflecting a re-fit viewport.
  const anchorBefore = await nodeBox(page, 0)
  const box = await nodeBox(page, 1)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 40, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.react-flow__node').nth(1)).toBeVisible()
  const dragged = await nodeBox(page, 1)
  expect(dragged.x).toBeGreaterThan(box.x + 60)
  const draggedOffset = { x: dragged.x - anchorBefore.x, y: dragged.y - anchorBefore.y }
  await waitForSaved(page)
  await page.reload()
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  const anchorAfter = await nodeBox(page, 0)
  const restored = await nodeBox(page, 1)
  const restoredOffset = { x: restored.x - anchorAfter.x, y: restored.y - anchorAfter.y }
  expect(Math.abs(restoredOffset.x - draggedOffset.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(restoredOffset.y - draggedOffset.y)).toBeLessThanOrEqual(2)
})

test('undoes a node drag in a single step', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  const box = await nodeBox(page, 0)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 40, { steps: 10 })
  await page.mouse.up()
  const dragged = await nodeBox(page, 0)
  expect(dragged.x).toBeGreaterThan(box.x + 60)
  await page.locator('.react-flow__node').nth(0).click()
  await page.keyboard.press('Control+z')
  await expect(async () => {
    const undone = await nodeBox(page, 0)
    expect(Math.abs(undone.x - box.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(undone.y - box.y)).toBeLessThanOrEqual(2)
  }).toPass({ timeout: 2_000 })
})

test('edits the title and markdown body inline on the card', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await page.locator('.concept-heading strong').dblclick()
  const titleInput = page.locator('.concept-title-input')
  await expect(titleInput).toBeVisible()
  await titleInput.fill('API Gateway')
  await titleInput.press('Enter')
  await expect(page.locator('.concept-heading strong')).toHaveText('API Gateway')
  await page.locator('.concept-body').dblclick()
  const bodyInput = page.locator('.concept-body-input')
  await expect(bodyInput).toBeVisible()
  await bodyInput.fill('Routes **bold** requests')
  await bodyInput.press('Control+Enter')
  await expect(page.locator('.concept-body strong')).toHaveText('bold')
  await waitForSaved(page)
  await page.reload()
  await expect(page.locator('.concept-heading strong')).toHaveText('API Gateway')
})

test('creates a connected child with Tab and renames it with F2', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await page.locator('.react-flow__node').nth(0).click()
  await page.keyboard.press('Tab')
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  const titleInput = page.locator('.concept-title-input')
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Child node')
  await titleInput.press('Enter')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await page.locator('.concept-heading', { hasText: 'Child node' }).click()
  await expect(page.getByRole('button', { name: 'Rename node' })).toBeVisible()
  await page.keyboard.press('F2')
  await expect(titleInput).toBeVisible()
  await titleInput.fill('Renamed')
  await titleInput.press('Enter')
  await expect(page.locator('.concept-node strong').nth(1)).toHaveText('Renamed')
})

test('collapses the sidebar and keeps it collapsed after reload', async ({ page }) => {
  await createProject(page)
  await expect(page.locator('.sidebar-shell')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.locator('.sidebar-shell')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.sidebar-shell')).toHaveCount(0)
})

test('shows the selection toolbar on a node and toggles the details drawer with Ctrl+I and Esc', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await page.locator('.react-flow__node').nth(0).click()
  await expect(page.locator('.selection-toolbar')).toBeVisible()
  await page.keyboard.press('Control+i')
  await expect(page.getByRole('complementary', { name: 'Details drawer' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Details drawer' })).not.toBeVisible()
})

test('edits a key-value property in the drawer and keeps it after reload', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await page.locator('.react-flow__node').nth(0).click()
  await page.keyboard.press('Control+i')
  await expect(page.locator('.details-drawer')).toBeVisible()
  const addRow = page.locator('.drawer-kv-add')
  await addRow.getByPlaceholder('Key').fill('owner')
  await addRow.getByPlaceholder('Value').fill('platform-team')
  await addRow.getByRole('button', { name: 'Add' }).click()
  const valueField = page.locator('.drawer-kv-row').filter({ hasText: 'owner' }).getByLabel('Value for owner')
  await expect(valueField).toHaveValue('platform-team')
  await waitForSaved(page)
  await page.reload()
  await page.locator('.react-flow__node').nth(0).click()
  await page.keyboard.press('Control+i')
  await expect(page.locator('.drawer-kv-row').filter({ hasText: 'owner' }).getByLabel('Value for owner')).toHaveValue('platform-team')
})

test('selects a node from the Outline and deletes the project through the confirm dialog', async ({ page }) => {
  await createProject(page)
  await page.keyboard.press('n')
  await addNodeFromToolbar(page)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await page.getByRole('list', { name: 'Outline' }).getByRole('button').first().click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  await page.getByRole('button', { name: 'Project menu' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible()
})
