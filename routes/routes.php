<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Nexia\Http\Middleware;
use Nexia\Apps\Nexia\SubmissionProof\Http\Controllers\NoteController;
// nexia:make-package-resource:controller-imports:end

Route::middleware([
    Middleware::APP_REQUEST,
    'app.installed:submission-proof',
    Middleware::LEGAL_ENTITY_CONTEXT,
    Middleware::WORKSPACE_CONTEXT,
])->group(function () {
    Route::prefix('api/submission-proof')->group(function () {
        Route::get('/notes/actions', [NoteController::class, 'collectionActions']);
        Route::middleware(['can.tenant_wide:submission-proof.note.read'])->group(function () {
            Route::get('/notes', [NoteController::class, 'index']);
            Route::get('/notes/{note}', [NoteController::class, 'show'])->whereUuid('note');
        });

        Route::middleware(['can.tenant_wide:submission-proof.note.create'])->group(function () {
            Route::post('/notes', [NoteController::class, 'store']);
        });

        Route::middleware(['can.tenant_wide:submission-proof.note.update'])->group(function () {
            Route::put('/notes/{note}', [NoteController::class, 'update'])->whereUuid('note');
        });

        Route::middleware(['can.tenant_wide:submission-proof.note.delete'])->group(function () {
            Route::delete('/notes/{note}', [NoteController::class, 'destroy'])->whereUuid('note');
        });
    });

    // nexia:make-package-resource:routes:end
});
