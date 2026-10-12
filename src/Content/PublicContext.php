<?php

namespace Drupal\evander_webmcp\Content;

use Drupal\Core\Session\AnonymousUserSession;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** Public request projection, without dispatching arbitrary controllers. */
final class PublicContext {
  public static function runtimeContexts(array $ids): array {
    $grouped = []; $contexts = [];
    foreach ($ids as $id) {
      if (preg_match('/^@([^:]+):(.+)$/', $id, $match)) $grouped[$match[1]][$match[2]] = $id;
    }
    foreach ($grouped as $service => $names) {
      // Query providers afresh; the shared context repository caches values for
      // the outer API request, not the target page's synthetic route.
      foreach (\Drupal::service($service)->getRuntimeContexts(array_keys($names)) as $name => $context) {
        if (isset($names[$name])) $contexts[$names[$name]] = $context;
      }
    }
    return $contexts;
  }
  public function __construct(private $switcher, private $stack, private $context, private $router, private $access, private $processor, private $currentPath, private $routeMatch) {}

  public function anonymous(callable $callback): mixed {
    $this->switcher->switchTo(new AnonymousUserSession());
    try { return $callback(); }
    finally { $this->switcher->switchBack(); }
  }

  public static function validPath(string $path): bool {
    return strlen($path) <= 2048 && str_starts_with($path, '/') && !str_starts_with($path, '//') && !preg_match('/[\x00-\x20\\\\?#]|%(?:00|0a|0d|5c|2f)/i', $path);
  }

  public function run(string $path, callable $callback): mixed {
    if (!self::validPath($path)) throw new \InvalidArgumentException('Use a local path without a query or fragment.');
    return $this->anonymous(function () use ($path, $callback) {
      $original = $this->stack->getCurrentRequest();
      $previous = clone $this->context;
      $request = Request::create($original->getSchemeAndHttpHost() . $path, 'GET');
      $this->stack->push($request);
      try {
        $internal = $this->processor->processInbound($path, $request);
        $this->currentPath->setPath($internal, $request);
        $this->context->fromRequest($request);
        $match = $this->router->matchRequest($request);
        $request->attributes->add($match);
        $this->routeMatch->resetRouteMatch();
        if (($match['_route_object'] ?? NULL)?->getOption('_admin_route') || !$this->access->checkRequest($request, new AnonymousUserSession())) throw new AccessDeniedHttpException();
        return $callback($request);
      }
      finally {
        $this->stack->pop();
        $this->context->fromRequest($original);
        $this->context->setBaseUrl($previous->getBaseUrl());
        $this->routeMatch->resetRouteMatch();
      }
    });
  }
}
