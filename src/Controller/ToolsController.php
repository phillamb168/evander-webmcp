<?php

namespace Drupal\evander_webmcp\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\evander_webmcp\Tool\Schema;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

final class ToolsController extends ControllerBase {
  private function response(array $data, int $status = 200): JsonResponse {
    return new JsonResponse($data, $status, ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff']);
  }
  private function limited(Request $request): bool {
    $flood = \Drupal::flood();
    $id = hash('sha256', $request->getClientIp() ?? 'unknown');
    $limit = max(1, min(600, (int) $this->config('evander_webmcp.settings')->get('requests_per_minute')));
    if (!$flood->isAllowed('evander_webmcp.call', $limit, 60, $id)) return TRUE;
    $flood->register('evander_webmcp.call', 60, $id);
    return FALSE;
  }
  public function manifest(Request $request): JsonResponse {
    if ($this->limited($request)) return $this->response(['error' => 'rate_limited'], 429);
    $tools = \Drupal::service('evander_webmcp.public_context')->anonymous(fn() => \Drupal::service('plugin.manager.evander_tool')->manifest($this->config('evander_webmcp.settings')->get('enabled_tools') ?? []));
    return $this->response(['version' => '1.0', 'tools' => $tools]);
  }
  public function call(Request $request): JsonResponse {
    if ($this->limited($request)) return $this->response(['error' => 'rate_limited'], 429);
    if ($request->getContentTypeFormat() !== 'json') return $this->response(['error' => 'json_required'], 415);
    if (strlen($request->getContent()) > 16384) return $this->response(['error' => 'request_too_large'], 413);
    $origin = $request->headers->get('Origin');
    if ($origin && $origin !== $request->getSchemeAndHttpHost()) return $this->response(['error' => 'origin_not_allowed'], 403);
    try {
      $body = json_decode($request->getContent(), TRUE, 32, JSON_THROW_ON_ERROR);
      if (!is_array($body) || array_diff(array_keys($body), ['name', 'arguments']) || !is_string($body['name'] ?? NULL) || !is_array($body['arguments'] ?? NULL)) throw new \InvalidArgumentException('Invalid tool request.');
      if (!in_array($body['name'], $this->config('evander_webmcp.settings')->get('enabled_tools') ?? [], TRUE)) return $this->response(['error' => 'tool_not_enabled'], 403);
      $manager = \Drupal::service('plugin.manager.evander_tool');
      if (!$manager->hasDefinition($body['name'])) return $this->response(['error' => 'tool_unavailable'], 404);
      $tool = $manager->createInstance($body['name']);
      Schema::checkSchema($tool->schema());
      Schema::validate($body['arguments'], $tool->schema());
      $result = \Drupal::service('evander_webmcp.public_context')->anonymous(fn() => $tool->execute($body['arguments']));
      if (strlen(json_encode($result)) > 160000) return $this->response(['error' => 'result_too_large'], 502);
      return $this->response(['version' => '1.0', 'result' => $result]);
    }
    catch (\JsonException | \InvalidArgumentException $e) { return $this->response(['error' => 'invalid_input', 'message' => $e->getMessage()], 400); }
    catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface | \Symfony\Component\Routing\Exception\ExceptionInterface $e) { return $this->response(['error' => 'public_content_unavailable'], 404); }
    catch (\Throwable $e) { return $this->response(['error' => 'tool_failed'], 502); }
  }
}
