để thêm vào theme UltimaTube cần add function để thêm custom_meta vào file fuctions.php
<?php
function custom_rest_api_post_meta() {
    register_rest_field( 'post', 'custom_meta', array(
        'get_callback' => 'get_post_meta_for_api',
        'update_callback' => 'update_post_meta_for_api',
        'schema' => null,
    ));
}

function get_post_meta_for_api( $object ) {
    $post_id = $object['id'];
    return get_post_meta( $post_id );
}

function update_post_meta_for_api( $value, $object, $field_name ) {
    foreach($value as $meta_key => $meta_value) {
        update_post_meta( $object->ID, $meta_key, $meta_value );
    }
}

add_action( 'rest_api_init', 'custom_rest_api_post_meta' );
?>
