<?php

namespace Drupal\evander_webmcp_example\Plugin\EvanderTool;

use Drupal\evander_webmcp\Attribute\EvanderTool;
use Drupal\evander_webmcp\Tool\ToolBase;

#[EvanderTool(id: 'get_care_now', title: 'Fictional care directory demo', description: 'DEMO DATA ONLY. List fictional urgent-care availability and links. Not medical advice, triage, appointment booking or live healthcare information. No personal information is needed.')]
final class GetCareNow extends ToolBase {
  public function execute(array $arguments): array {
    return [
      'status' => 'ok', 'coverage' => 'complete', 'fictional' => TRUE,
      'items' => [
        ['id' => 'fictional-north', 'label' => 'Fictional North Clinic — demo only', 'facts' => [
          ['label' => 'Estimated wait', 'value' => '15 minutes (fictional test fixture)'],
          ['label' => 'Notice', 'value' => 'Not live data. Do not use this example to seek care.'],
        ], 'links' => [['label' => 'Example domain (not a booking service)', 'url' => 'https://example.org/']]],
        ['id' => 'fictional-south', 'label' => 'Fictional South Clinic — demo only', 'facts' => [
          ['label' => 'Estimated wait', 'value' => 'Unavailable — zero or missing data must not be described as an immediate appointment.'],
        ], 'links' => []],
      ],
    ];
  }
}
