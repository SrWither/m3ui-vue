<!--
/**
 * Wrapper that sets `position: relative` on a container. Use it as the positioning parent for MAbsolute
 * children.
 *
 * @slot default Content; absolutely positioned children are placed relative to it.
 */
-->
<template>
  <div class="relative">
    <slot />
  </div>
</template>
