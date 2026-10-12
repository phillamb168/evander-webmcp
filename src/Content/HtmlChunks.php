<?php

namespace Drupal\evander_webmcp\Content;

/** Plain-text, paragraph-sized projections. No raw HTML or form values escape. */
final class HtmlChunks {
  public static function excluded(\DOMElement $node): bool {
    return in_array(strtolower($node->tagName), ['script', 'style', 'template', 'form', 'input', 'textarea', 'select', 'button', 'noscript'], TRUE)
      || $node->hasAttribute('hidden') || strtolower($node->getAttribute('aria-hidden')) === 'true'
      || preg_match('/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i', $node->getAttribute('style'));
  }

  private static function document(string $html): array {
    $dom = new \DOMDocument();
    $previous = libxml_use_internal_errors(TRUE);
    $dom->loadHTML('<?xml encoding="utf-8"?><div data-evander-root="1">' . $html . '</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    return [$dom, (new \DOMXPath($dom))->query('//*[@data-evander-root]')->item(0)];
  }

  public static function decorate(string $html, string $namespace): string {
    if (trim($html) === '') return '';
    [$dom, $root] = self::document($html);
    $namespace = preg_replace('/[^a-zA-Z0-9_-]/', '-', $namespace);
    $used = [];
    foreach ((new \DOMXPath($dom))->query('//*[@id]') as $element) $used[$element->getAttribute('id')] = TRUE;
    $allocate = static function (string $id) use (&$used): string {
      $base = $id; $n = 1;
      while (isset($used[$id])) $id = $base . '-' . ++$n;
      $used[$id] = TRUE;
      return $id;
    };
    $root->setAttribute('id', $allocate($namespace));
    $root->setAttribute('data-evander-section', '');
    $i = 0;
    foreach ((new \DOMXPath($dom))->query('//h1|//h2|//h3|//h4|//h5|//h6') as $heading) {
      if (!$heading->hasAttribute('id')) $heading->setAttribute('id', $allocate($namespace . '-heading-' . ++$i));
    }
    $root->removeAttribute('data-evander-root');
    return $dom->saveHTML($root);
  }

  public static function extract(string $html, string $namespace, int $limit = 6000): array {
    if (trim($html) === '') return ['chunks' => [], 'links' => []];
    [, $root] = self::document($html);
    $chunks = []; $links = []; $headings = []; $heading = 'Overview'; $anchor = NULL; $buffer = '';
    $ids = [];
    foreach ((new \DOMXPath($root->ownerDocument))->query('//*[@id]') as $node) $ids[$node->getAttribute('id')] = ($ids[$node->getAttribute('id')] ?? 0) + 1;
    $flush = static function () use (&$buffer, &$chunks, &$heading, &$headings, &$anchor, $namespace, $limit) {
      $text = trim((string) preg_replace('/[\t\r ]+/u', ' ', $buffer));
      while ($text !== '') {
        $part = mb_strcut($text, 0, max(256, $limit), 'UTF-8');
        if (strlen($part) < strlen($text)) {
          $boundary = strrpos($part, ' ');
          if ($boundary !== FALSE && $boundary > strlen($part) / 2) $part = substr($part, 0, $boundary);
        }
        $chunks[] = ['id' => $namespace . '-' . count($chunks), 'heading' => $heading, 'parents' => array_values($headings), 'text' => $part] + ($anchor ? ['anchor' => $anchor] : []);
        $text = ltrim(substr($text, strlen($part)));
      }
      $buffer = '';
    };
    $walk = function (\DOMNode $node) use (&$walk, &$buffer, &$headings, &$heading, &$anchor, &$links, $flush, $ids) {
      if ($node instanceof \DOMText) { $buffer .= $node->textContent; return; }
      if (!$node instanceof \DOMElement || self::excluded($node)) return;
      $tag = strtolower($node->tagName);
      if ($node->hasAttribute('data-evander-section')) {
        $flush();
        $id = $node->getAttribute('id');
        $anchor = ($ids[$id] ?? 0) === 1 ? '#' . rawurlencode($id) : NULL;
      }
      if (preg_match('/^h([1-6])$/', $tag, $m)) {
        $flush(); $heading = trim(self::visibleText($node));
        foreach (array_keys($headings) as $level) if ($level >= (int) $m[1]) unset($headings[$level]);
        $headings[(int) $m[1]] = $heading;
        $id = $node->getAttribute('id');
        $anchor = $id !== '' && ($ids[$id] ?? 0) === 1 ? '#' . rawurlencode($id) : NULL;
        return;
      }
      if ($tag === 'a' && $node->hasAttribute('href')) $links[] = ['label' => trim(self::visibleText($node)), 'url' => $node->getAttribute('href')];
      if ($tag === 'img') { $buffer .= ' ' . $node->getAttribute('alt') . ' '; return; }
      if ($tag === 'table') {
        $flush();
        $headers = [];
        foreach ($node->getElementsByTagName('th') as $cell) {
          for ($parent = $cell; $parent instanceof \DOMElement && $parent !== $node; $parent = $parent->parentNode) if (self::excluded($parent)) continue 2;
          $headers[] = trim(self::visibleText($cell));
        }
        foreach ($node->getElementsByTagName('tr') as $row) {
          for ($parent = $row; $parent instanceof \DOMElement && $parent !== $node; $parent = $parent->parentNode) if (self::excluded($parent)) continue 2;
          $cells = [];
          foreach ($row->childNodes as $cell) if ($cell instanceof \DOMElement && in_array(strtolower($cell->tagName), ['td', 'th'], TRUE)) $cells[] = trim(self::visibleText($cell));
          if ($cells) { $buffer = ($headers ? 'Columns: ' . implode(' | ', $headers) . "\n" : '') . implode(' | ', $cells); $flush(); }
        }
        return;
      }
      foreach ($node->childNodes as $child) $walk($child);
      if (in_array($tag, ['p', 'li', 'blockquote'], TRUE)) $flush();
      elseif (in_array($tag, ['div', 'section', 'br', 'article'], TRUE)) $buffer .= "\n";
    };
    $walk($root); $flush();
    return ['chunks' => $chunks, 'links' => $links];
  }

  private static function visibleText(\DOMNode $node): string {
    if ($node instanceof \DOMText) return $node->textContent;
    if (!$node instanceof \DOMElement || self::excluded($node)) return '';
    $text = '';
    foreach ($node->childNodes as $child) $text .= self::visibleText($child);
    return $text;
  }
}
