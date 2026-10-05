<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_proof_notes', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();

            $table->string('name');
            $table->timestamps();
            $table->softDeletes();

            // Generator contract: list paths constrain tenant/legal-entity,
            // then recency. Keep equality columns before
            // created_at so new Resources start with the required index shape.
            $table->index(['created_at'], 'submission_proof_notes_created_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_proof_notes');
    }
};
