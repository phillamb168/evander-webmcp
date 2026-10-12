<?php

namespace Drupal\evander_webmcp\Form;

use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;

final class SettingsForm extends ConfigFormBase {
  public function getFormId(): string { return 'evander_webmcp_settings'; }
  protected function getEditableConfigNames(): array { return ['evander_webmcp.settings']; }

  public function buildForm(array $form, FormStateInterface $form_state): array {
    $config = $this->config('evander_webmcp.settings');
    $form['description'] = ['#markup' => '<p>WebMCP runs through Drupal without a backend. Only configure public content. Enabling the backend adds chat and sends user prompts and selected public content to your configured inference service.</p>'];
    $form['enable_backend'] = ['#type' => 'checkbox', '#title' => $this->t('Enable Evander backend'), '#default_value' => $config->get('enable_backend')];
    foreach (['backend_endpoint' => 'Backend endpoint (HTTPS)', 'public_site_id' => 'Public site identifier'] as $key => $label) $form[$key] = ['#type' => 'textfield', '#title' => $this->t($label), '#default_value' => $config->get($key), '#description' => $this->t('No secrets belong in this field.')];
    $options = [];
    foreach (\Drupal::service('plugin.manager.evander_tool')->getDefinitions() as $id => $definition) $options[$id] = $definition['title'] . ' (' . $id . ')';
    $form['enabled_tools'] = ['#type' => 'checkboxes', '#title' => $this->t('Public read-only tools'), '#options' => $options, '#default_value' => $config->get('enabled_tools') ?? []];
    foreach (['allowed_fields' => 'Approved displayed field machine names', 'allowed_bundles' => 'Node bundles (empty means all)', 'allowed_blocks' => 'Approved block placement IDs', 'menus' => 'Navigation menu machine names', 'sitemaps' => 'Same-origin sitemap paths or URLs'] as $key => $label) $form[$key] = ['#type' => 'textarea', '#title' => $this->t($label), '#default_value' => implode("\n", $config->get($key) ?? []), '#description' => $this->t('One value per line. Hidden/private fields are never a fallback source.')];
    $indexes = ['' => $this->t('No full-text search (sitemap/navigation only)')];
    if (\Drupal::moduleHandler()->moduleExists('evander_webmcp_search_api')) {
      foreach (\Drupal::entityTypeManager()->getStorage('search_api_index')->loadMultiple() as $index) if ($index->status()) $indexes[$index->id()] = $index->label();
    }
    $form['search_index'] = ['#type' => 'select', '#title' => $this->t('Search API index'), '#options' => $indexes, '#default_value' => $config->get('search_index')];
    $form['search_fields'] = ['#type' => 'textarea', '#title' => $this->t('Approved indexed full-text field IDs'), '#default_value' => implode("\n", $config->get('search_fields') ?? []), '#description' => $this->t('One per line. Select only fields whose indexed contents are public; snippets are not taken from the index.')];
    foreach (['max_response_bytes' => [8000, 120000], 'chunk_bytes' => [256, 6000], 'requests_per_minute' => [1, 600]] as $key => [$min, $max]) $form[$key] = ['#type' => 'number', '#title' => $key, '#default_value' => $config->get($key), '#min' => $min, '#max' => $max, '#required' => TRUE];
    $form['status'] = ['#markup' => '<p>Manifest: <a href="' . \Drupal\Core\Url::fromRoute('evander_webmcp.tools')->toString() . '">View enabled tools</a>. The backend is optional; Search API must be separately installed and configured for full-text search.</p>'];
    return parent::buildForm($form, $form_state);
  }

  public function validateForm(array &$form, FormStateInterface $form_state): void {
    parent::validateForm($form, $form_state);
    $endpoint = trim($form_state->getValue('backend_endpoint'));
    if ($form_state->getValue('enable_backend') && (!str_starts_with($endpoint, 'https://') || !filter_var($endpoint, FILTER_VALIDATE_URL) || !$form_state->getValue('public_site_id'))) $form_state->setErrorByName('backend_endpoint', $this->t('An HTTPS endpoint and public site identifier are required.'));
    foreach ($this->lines($form_state->getValue('sitemaps')) as $url) {
      $origin = \Drupal::request()->getSchemeAndHttpHost();
      if ((!str_starts_with($url, '/') || str_starts_with($url, '//')) && !str_starts_with($url, $origin . '/')) $form_state->setErrorByName('sitemaps', $this->t('Sitemaps must use the current site origin.'));
    }
    $id = $form_state->getValue('search_index');
    if ($id) {
      $index = \Drupal::entityTypeManager()->getStorage('search_api_index')->load($id);
      $fields = $this->lines($form_state->getValue('search_fields'));
      $allowed = [];
      foreach ($index->getFields() as $key => $field) if ($field->getType() === 'text' || str_starts_with($field->getType(), 'solr_text')) $allowed[] = $key;
      if (!$fields || array_diff($fields, $allowed)) $form_state->setErrorByName('search_fields', $this->t('Choose existing full-text field IDs from the selected index.'));
    }
  }

  private function lines(string $value): array { return array_values(array_unique(array_filter(array_map('trim', explode("\n", $value))))); }
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    $config = $this->config('evander_webmcp.settings');
    foreach (['allowed_fields', 'allowed_bundles', 'allowed_blocks', 'menus', 'sitemaps', 'search_fields'] as $key) $config->set($key, $this->lines($form_state->getValue($key)));
    foreach (['backend_endpoint', 'public_site_id', 'search_index'] as $key) $config->set($key, trim($form_state->getValue($key)));
    foreach (['max_response_bytes', 'chunk_bytes', 'requests_per_minute'] as $key) $config->set($key, (int) $form_state->getValue($key));
    $config->set('enabled_tools', array_values(array_filter($form_state->getValue('enabled_tools'))))->set('enable_backend', (bool) $form_state->getValue('enable_backend'))->save();
    parent::submitForm($form, $form_state);
  }
}
